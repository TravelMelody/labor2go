'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateWIB } from '@/lib/format'

type RoleFilter = 'all' | 'student' | 'umkm' | 'admin'
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

interface UserProfileRow {
  id: string
  full_name: string | null
  role: 'student' | 'umkm' | 'admin'
  verification_status: 'pending' | 'approved' | 'rejected'
  no_show_count: number
  created_at: string
}

const PAGE_SIZE = 25

export function AdminUsersView() {
  const supabase = useMemo(() => createClient(), [])
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const [users, setUsers] = useState<UserProfileRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Debounce pencarian nama 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim()
      setDebouncedSearch((prev) => {
        if (prev !== next) {
          setLoading(true)
          setPage(1)
        }
        return next
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    const run = async () => {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('profiles')
        .select(
          'id, full_name, role, verification_status, no_show_count, created_at',
          { count: 'exact' }
        )

      if (debouncedSearch) {
        query = query.ilike('full_name', `%${debouncedSearch}%`)
      }
      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter)
      }
      if (statusFilter !== 'all') {
        query = query.eq('verification_status', statusFilter)
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (!active) return

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan saat memuat daftar pengguna:', error.message)
        } else {
          console.error('Gagal memuat daftar pengguna:', error)
        }
        setErrorMsg(error.message || 'Gagal memuat daftar pengguna.')
        setLoading(false)
        return
      }

      setErrorMsg(null)
      setUsers((data ?? []) as UserProfileRow[])
      setTotalCount(count ?? 0)
      setLoading(false)
    }

    void run().catch((err) => {
      if (!active) return
      console.error('Kesalahan tak terduga saat memuat daftar pengguna:', err)
      setErrorMsg('Terjadi kesalahan tak terduga saat memuat data.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [supabase, page, debouncedSearch, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const startIndex = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(page * PAGE_SIZE, totalCount)

  const getRoleBadge = (role: UserProfileRow['role']) => {
    switch (role) {
      case 'student':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFEDE0] text-[#FF6B00]">
            Mahasiswa
          </span>
        )
      case 'umkm':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E5EEFF] text-[#0B1C30]">
            Merchant
          </span>
        )
      case 'admin':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Admin
          </span>
        )
    }
  }

  const getVerificationBadge = (
    role: UserProfileRow['role'],
    status: UserProfileRow['verification_status']
  ) => {
    if (role === 'admin') {
      return <span className="text-xs text-gray-400">-</span>
    }
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Disetujui
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            Ditolak
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Menunggu
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight">
          Daftar Pengguna
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Lihat seluruh akun terdaftar beserta status verifikasi dan riwayat ketidakhadiran.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama pengguna..."
            className="w-full h-10 pl-10 pr-3.5 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-hidden text-xs sm:text-sm"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setLoading(true)
            setRoleFilter(e.target.value as RoleFilter)
            setPage(1)
          }}
          aria-label="Filter role"
          className="w-full h-10 px-3.5 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-hidden text-xs sm:text-sm bg-white"
        >
          <option value="all">Semua Role</option>
          <option value="student">Mahasiswa</option>
          <option value="umkm">Merchant</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setLoading(true)
            setStatusFilter(e.target.value as StatusFilter)
            setPage(1)
          }}
          aria-label="Filter status verifikasi"
          className="w-full h-10 px-3.5 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-hidden text-xs sm:text-sm bg-white"
        >
          <option value="all">Semua Status Verifikasi</option>
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
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
      ) : users.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-gray-100 shadow-xs text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#E5EEFF] text-[#0B1C30] flex items-center justify-center mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B1C30]">
            Tidak ada pengguna ditemukan
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Ubah kata kunci pencarian atau filter untuk melihat pengguna lain.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8F9FF]/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Nama</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Role</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    Status Verifikasi
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    Jumlah Tidak Hadir
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    Tanggal Daftar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-[#F8F9FF]/50 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-bold text-[#0B1C30]">
                        {u.full_name?.trim() || 'Tanpa Nama'}
                      </p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getRoleBadge(u.role)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getVerificationBadge(u.role, u.verification_status)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-bold ${
                          u.no_show_count > 0 ? 'text-red-600' : 'text-gray-600'
                        }`}
                      >
                        {u.no_show_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">
                      {formatDateWIB(u.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#F8F9FF]/40">
            <p className="text-xs text-gray-500 font-medium">
              Menampilkan{' '}
              <span className="font-bold text-[#0B1C30]">
                {startIndex}–{endIndex}
              </span>{' '}
              dari{' '}
              <span className="font-bold text-[#0B1C30]">
                {totalCount.toLocaleString('id-ID')}
              </span>{' '}
              pengguna
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true)
                  setPage((p) => Math.max(1, p - 1))
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#0B1C30] hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-xs font-bold text-gray-600 px-2">
                Halaman {page} dari {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setLoading(true)
                  setPage((p) => Math.min(totalPages, p + 1))
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#0B1C30] hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
