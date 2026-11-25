import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  mapStatus,
  parseGrossAmount,
  verifySignature,
  type MidtransNotificationBody,
} from '@/lib/midtrans'

export async function POST(request: Request) {
  try {
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Format JSON tidak valid' },
        { status: 400 }
      )
    }

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json(
        { error: 'Payload notifikasi tidak valid' },
        { status: 400 }
      )
    }

    const body = rawBody as MidtransNotificationBody

    let isValidSignature = false
    try {
      isValidSignature = verifySignature(body)
    } catch (error) {
      console.error('Gagal memverifikasi signature webhook Midtrans:', error)
      return NextResponse.json(
        { error: 'Konfigurasi verifikasi webhook bermasalah' },
        { status: 500 }
      )
    }

    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Signature tidak valid' },
        { status: 403 }
      )
    }

    const orderId = body.order_id!
    const mappedStatus = mapStatus(body.transaction_status, body.fraud_status)
    const admin = createAdminClient()

    if (mappedStatus === 'paid') {
      const grossAmount = parseGrossAmount(body.gross_amount)
      if (grossAmount === null) {
        console.error('Nominal gross_amount webhook Midtrans tidak valid:', {
          orderId,
          grossAmount: body.gross_amount,
        })
        return NextResponse.json(
          { error: 'Nominal gross_amount tidak valid' },
          { status: 400 }
        )
      }

      const { error: rpcError } = await admin.rpc('credit_topup', {
        p_order_id: orderId,
        p_gross_amount: grossAmount,
      })

      if (rpcError) {
        if (rpcError.code === 'P0001') {
          console.warn(
            'Validasi bisnis credit_topup pada webhook:',
            rpcError.message
          )
          return NextResponse.json({ ok: true })
        }
        console.error('Gagal memanggil RPC credit_topup pada webhook:', rpcError)
        return NextResponse.json(
          { error: 'Gagal memproses notifikasi pembayaran' },
          { status: 500 }
        )
      }
    } else if (mappedStatus === 'failed') {
      const { error: rpcError } = await admin.rpc('fail_topup', {
        p_order_id: orderId,
      })

      if (rpcError) {
        console.error('Gagal memanggil RPC fail_topup pada webhook:', rpcError)
        return NextResponse.json(
          { error: 'Gagal memproses notifikasi pembayaran gagal' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ ok: true, status: mappedStatus })
  } catch (error) {
    console.error(
      'Kesalahan tak terduga pada POST /api/midtrans/notification:',
      error
    )
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}
