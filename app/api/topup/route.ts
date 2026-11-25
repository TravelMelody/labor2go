import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMidtransAuthHeader, SNAP_URL } from '@/lib/midtrans'

const MIN_TOPUP_AMOUNT = 10_000
const MAX_TOPUP_AMOUNT = 5_000_000

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
        { status: 403 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Gagal membaca profil pengguna untuk top-up:', profileError)
      return NextResponse.json(
        { error: 'Gagal memverifikasi profil pengguna' },
        { status: 500 }
      )
    }

    if (profile?.role !== 'umkm') {
      return NextResponse.json(
        { error: 'Hanya akun UMKM yang dapat melakukan isi saldo' },
        { status: 403 }
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

    const amount =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
        ? (rawBody as { amount?: unknown }).amount
        : undefined

    if (
      typeof amount !== 'number' ||
      !Number.isInteger(amount) ||
      amount < MIN_TOPUP_AMOUNT ||
      amount > MAX_TOPUP_AMOUNT
    ) {
      return NextResponse.json(
        {
          error:
            'Nominal isi saldo harus berupa bilangan bulat antara Rp 10.000 hingga Rp 5.000.000',
        },
        { status: 400 }
      )
    }

    const randomCode = crypto.randomBytes(3).toString('hex').toUpperCase()
    const orderId = `L2G-${Date.now()}-${randomCode}`

    const admin = createAdminClient()

    const { error: insertError } = await admin
      .from('wallet_transactions')
      .insert({
        user_id: user.id,
        type: 'topup',
        amount,
        status: 'pending',
        external_ref: orderId,
        note: 'Isi saldo via Midtrans',
      })

    if (insertError) {
      console.error('Gagal menyimpan transaksi top-up pending:', insertError)
      return NextResponse.json(
        { error: 'Gagal mencatat transaksi isi saldo' },
        { status: 500 }
      )
    }

    const firstName = profile.full_name?.trim() || 'Mitra UMKM'
    const customerDetails: { first_name: string; email?: string } = {
      first_name: firstName,
    }
    if (user.email) {
      customerDetails.email = user.email
    }

    let snapRes: Response
    let snapData: { token?: unknown; error_messages?: unknown } | null = null

    try {
      snapRes = await fetch(SNAP_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: getMidtransAuthHeader(),
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: orderId,
            gross_amount: amount,
          },
          customer_details: customerDetails,
        }),
      })
      snapData = (await snapRes.json().catch(() => null)) as {
        token?: unknown
        error_messages?: unknown
      } | null
    } catch (fetchError) {
      console.error('Gagal menghubungi Midtrans Snap API:', fetchError)
      const { error: failError } = await admin.rpc('fail_topup', {
        p_order_id: orderId,
      })
      if (failError) {
        console.error('Gagal menandai top-up gagal setelah error Snap:', failError)
      }
      return NextResponse.json(
        { error: 'Gagal menghubungi layanan pembayaran Midtrans' },
        { status: 502 }
      )
    }

    const token =
      typeof snapData?.token === 'string' && snapData.token.length > 0
        ? snapData.token
        : null

    if (!snapRes.ok || !token) {
      console.error('Midtrans Snap API mengembalikan kegagalan:', {
        status: snapRes.status,
        orderId,
        errorMessages: snapData?.error_messages,
      })

      const { error: failError } = await admin.rpc('fail_topup', {
        p_order_id: orderId,
      })
      if (failError) {
        console.error('Gagal menandai top-up gagal setelah Snap ditolak:', failError)
      }

      const midtransMsg = Array.isArray(snapData?.error_messages)
        ? snapData.error_messages.filter((m) => typeof m === 'string').join('; ')
        : ''

      return NextResponse.json(
        {
          error: midtransMsg
            ? `Gagal membuat transaksi pembayaran Midtrans: ${midtransMsg}`
            : 'Gagal membuat transaksi pembayaran Midtrans',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      token,
      order_id: orderId,
    })
  } catch (error) {
    console.error('Kesalahan tak terduga pada POST /api/topup:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memproses isi saldo' },
      { status: 500 }
    )
  }
}
