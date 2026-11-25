'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, RefreshCw, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatFullDateTimeWIB } from '@/lib/format'

interface AdminProfileRef {
  full_name: string | null
}

interface RawAuditLogRow {
  id: string
  admin_id: string | null
  action: string
  target_id: string | null
  note: string | null
  created_at: string
  profiles: AdminProfileRef | AdminProfileRef[] | null
}

interface AuditLogItem {
  id: string
  created_at: string
  admin_name: string
  action_label: string
  note: string
}

function pickOne<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return val[0] ?? null
  return val ?? null
}

function translateAction(action: string): string {
  switch (action) {
    case 'verification_approved':
      return 'Menyetujui verifikasi'
    case 'verification_rejected':
      return 'Menolak verifikasi'
    case 'withdrawal_processed':
      return 'Memproses penarikan dana'
    case 'withdrawal_rejected':
      return 'Menolak penarikan dana'
    case 'phone_viewed':
      return 'Melihat nomor HP pengguna'
    default:
      return action
  }
}

export function AdminAuditLogView() {
  const supabase = useMemo(() => createClient(), [])
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setRefreshing(true)
      setErrorMsg(null)

      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('id, admin_id, action, target_id, note, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan saat memuat log aktivitas:', error.message)
        } else {
          console.error('Gagal memuat log aktivitas admin:', error)
        }
        setErrorMsg(error.message || 'Gagal memuat log aktivitas.')
        return
      }

      const rows = (data ?? []) as unknown as RawAuditLogRow[]
      setLogs(
        rows.map((row) => {
          const adminProf = pickOne(row.profiles)
          return {
            id: row.id,
            created_at: row.created_at,
            admin_name: adminProf?.full_name?.trim() || 'Admin',
            action_label: translateAction(row.action),
            note: row.note?.trim() || '-',
          }
        })
      )
    } catch (err) {
      console.error('Kesalahan tak terduga saat memuat log aktivitas:', err)
      setErrorMsg('Terjadi kesalahan tak terduga saat memuat data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    const run = async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('id, admin_id, action, target_id, note, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!active) return

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan saat memuat log aktivitas:', error.message)
        } else {
          console.error('Gagal memuat log aktivitas admin:', error)
        }
        setErrorMsg(error.message || 'Gagal memuat log aktivitas.')
        setLoading(false)
        return
      }

      const rows = (data ?? []) as unknown as RawAuditLogRow[]
      setLogs(
        rows.map((row) => {
          const adminProf = pickOne(row.profiles)
          return {
            id: row.id,
            created_at: row.created_at,
            admin_name: adminProf?.full_name?.trim() || 'Admin',
            action_label: translateAction(row.action),
            note: row.note?.trim() || '-',
          }
        })
      )
      setErrorMsg(null)
      setLoading(false)
    }

    void run().catch((err) => {
      if (!active) return
      console.error('Kesalahan tak terduga saat memuat log aktivitas:', err)
      setErrorMsg('Terjadi kesalahan tak terduga saat memuat data.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [supabase])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight">
            Log Aktivitas Admin
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Menampilkan 50 tindakan verifikasi dan penarikan dana terbaru oleh admin.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs()}
          disabled={loading || refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#0B1C30] hover:bg-gray-50 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#FF6B00] ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col gap-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-gray-100 shadow-xs text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B1C30]">
            Belum ada log aktivitas
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Riwayat tindakan admin akan tercatat otomatis di sini.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8F9FF]/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Waktu WIB</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Nama Admin</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Aksi</th>
                  <th className="py-3.5 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-[#F8F9FF]/50 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">
                      {formatFullDateTimeWIB(log.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-[#0B1C30]">
                      {log.admin_name}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-[#0B1C30]">
                      {log.action_label}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {log.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
