import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMidtransAuthHeader,
  mapStatus,
  parseGrossAmount,
  STATUS_URL,
  type TopupMappedStatus,
} from '@/lib/midtrans'

interface MidtransStatusResponse {
  status_code?: string
  transaction_status?: string
  fraud_status?: string
  gross_amount?: string | number
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Kamu harus login terlebih dahulu' },
        { status: 401 }
      )
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Format JSON tidak valid' },
        { status: 400 }
      )
    }

    const rawOrderId =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
        ? (rawBody as { order_id?: unknown }).order_id
        : undefined

    const orderId = typeof rawOrderId === 'string' ? rawOrderId.trim() : ''
    if (!orderId || orderId.length > 50) {
      return NextResponse.json(
        { error: 'order_id tidak valid' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: tx, error: txError } = await admin
      .from('wallet_transactions')
      .select('id, status')
      .eq('external_ref', orderId)
      .eq('type', 'topup')
      .eq('user_id', user.id)
      .maybeSingle()

    if (txError) {
      console.error('Gagal memeriksa kepemilikan transaksi top-up:', txError)
      return NextResponse.json(
        { error: 'Gagal memeriksa transaksi isi saldo' },
        { status: 500 }
      )
    }

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaksi top-up tidak ditemukan' },
        { status: 404 }
      )
    }

    let statusRes: Response
    let statusData: MidtransStatusResponse | null = null

    try {
      statusRes = await fetch(STATUS_URL(orderId), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: getMidtransAuthHeader(),
        },
      })
      statusData = (await statusRes
        .json()
        .catch(() => null)) as MidtransStatusResponse | null
    } catch (fetchError) {
      console.error('Gagal menghubungi Midtrans Status API:', fetchError)
      return NextResponse.json(
        { error: 'Gagal memeriksa status pembayaran ke Midtrans' },
        { status: 502 }
      )
    }

    let mappedStatus: TopupMappedStatus

    if (statusRes.status === 404 || statusData?.status_code === '404') {
      mappedStatus = 'pending'
    } else if (!statusRes.ok) {
      console.error('Midtrans Status API mengembalikan kegagalan:', {
        status: statusRes.status,
        statusCode: statusData?.status_code,
        orderId,
      })
      return NextResponse.json(
        { error: 'Gagal memeriksa status pembayaran ke Midtrans' },
        { status: 502 }
      )
    } else {
      mappedStatus = mapStatus(
        statusData?.transaction_status,
        statusData?.fraud_status
      )
    }

    if (mappedStatus === 'paid') {
      const grossAmount = parseGrossAmount(statusData?.gross_amount)
      if (grossAmount === null) {
        console.error('Nominal gross_amount dari Midtrans tidak valid:', {
          orderId,
          grossAmount: statusData?.gross_amount,
        })
        return NextResponse.json(
          { error: 'Data nominal pembayaran dari Midtrans tidak valid' },
          { status: 502 }
        )
      }

      const { error: rpcError } = await admin.rpc('credit_topup', {
        p_order_id: orderId,
        p_gross_amount: grossAmount,
      })

      if (rpcError) {
        if (rpcError.code === 'P0001') {
          console.warn('Validasi bisnis credit_topup gagal:', rpcError.message)
          return NextResponse.json({ error: rpcError.message }, { status: 400 })
        }
        console.error('Gagal memanggil RPC credit_topup:', rpcError)
        return NextResponse.json(
          { error: 'Gagal memproses penambahan saldo' },
          { status: 500 }
        )
      }
    } else if (mappedStatus === 'failed') {
      const { error: rpcError } = await admin.rpc('fail_topup', {
        p_order_id: orderId,
      })

      if (rpcError) {
        console.error('Gagal memanggil RPC fail_topup:', rpcError)
        return NextResponse.json(
          { error: 'Gagal memperbarui status transaksi gagal' },
          { status: 500 }
        )
      }
    }

    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    if (walletError) {
      console.error('Gagal membaca saldo dompet terbaru:', walletError)
      return NextResponse.json(
        { error: 'Gagal mengambil saldo dompet terbaru' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: mappedStatus,
      balance: wallet?.balance ?? 0,
    })
  } catch (error) {
    console.error('Kesalahan tak terduga pada POST /api/topup/verify:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memverifikasi top-up' },
      { status: 500 }
    )
  }
}
