import 'server-only'

import crypto from 'node:crypto'

export const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions'

export const STATUS_URL = (orderId: string) =>
  `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`

function getMidtransServerKey(): string {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi')
  }
  return serverKey
}

export function getMidtransAuthHeader(): string {
  const encoded = Buffer.from(`${getMidtransServerKey()}:`).toString('base64')
  return `Basic ${encoded}`
}

export interface MidtransNotificationBody {
  order_id?: string
  status_code?: string
  gross_amount?: string
  signature_key?: string
  transaction_status?: string
  fraud_status?: string
  [key: string]: unknown
}

export function verifySignature(body: MidtransNotificationBody): boolean {
  if (
    typeof body.order_id !== 'string' ||
    body.order_id.length === 0 ||
    typeof body.status_code !== 'string' ||
    body.status_code.length === 0 ||
    typeof body.gross_amount !== 'string' ||
    body.gross_amount.length === 0 ||
    typeof body.signature_key !== 'string' ||
    body.signature_key.length === 0
  ) {
    return false
  }

  const payload = `${body.order_id}${body.status_code}${body.gross_amount}${getMidtransServerKey()}`
  const expected = crypto.createHash('sha512').update(payload).digest('hex')

  const expectedBuf = Buffer.from(expected, 'utf8')
  const receivedBuf = Buffer.from(body.signature_key.toLowerCase(), 'utf8')

  if (expectedBuf.length !== receivedBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf)
}

export type TopupMappedStatus = 'paid' | 'failed' | 'pending'

export function mapStatus(
  transactionStatus?: string | null,
  fraudStatus?: string | null
): TopupMappedStatus {
  if (
    transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept')
  ) {
    return 'paid'
  }

  if (
    transactionStatus === 'deny' ||
    transactionStatus === 'cancel' ||
    transactionStatus === 'expire' ||
    transactionStatus === 'failure'
  ) {
    return 'failed'
  }

  return 'pending'
}

export function parseGrossAmount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const rounded = Math.round(parsed)
  if (!Number.isSafeInteger(rounded) || rounded <= 0) {
    return null
  }

  return rounded
}
