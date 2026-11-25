export type WalletTxType =
  | 'topup'
  | 'job_payment'
  | 'job_earning'
  | 'commission'
  | 'withdrawal'
  | 'refund'

export type WalletTxStatus = 'pending' | 'success' | 'failed'

export interface WalletTransactionItem {
  id: string
  type: WalletTxType
  amount: number
  status: WalletTxStatus
  application_id: string | null
  external_ref: string | null
  note: string | null
  created_at: string
}

export const WALLET_TX_PAGE_SIZE = 20
