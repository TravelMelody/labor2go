import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatAccessRedirect } from '@/components/chat/ChatAccessRedirect'
import { ChatRoomView, type ChatMessage } from '@/components/chat/ChatRoomView'

interface PageProps {
  params: Promise<{ applicationId: string }>
}

interface CounterpartContactRow {
  full_name: string | null
}

interface ApplicationWithJobRow {
  id: string
  status: string
  job_id: string
  student_id: string
  jobs:
    | { id: string; title: string; umkm_id: string }
    | Array<{ id: string; title: string; umkm_id: string }>
    | null
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const metadata = {
  title: 'Chat Pekerjaan – Labor2Go',
  description: 'Percakapan dalam aplikasi antara mahasiswa dan merchant Labor2Go',
}

function ChatSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8F9FF] flex flex-col items-center">
      <div className="w-full max-w-[420px] h-dvh bg-[#F8F9FF] flex flex-col animate-pulse">
        <div className="h-16 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-1.5">
            <div className="w-32 h-4 bg-gray-200 rounded" />
            <div className="w-44 h-3 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="w-3/4 h-12 bg-white rounded-2xl" />
          <div className="w-2/3 h-12 bg-orange-100 rounded-2xl ml-auto" />
          <div className="w-1/2 h-10 bg-white rounded-2xl" />
        </div>
        <div className="h-16 bg-white border-t border-gray-100 px-4 flex items-center gap-2">
          <div className="flex-1 h-10 bg-gray-100 rounded-2xl" />
          <div className="w-10 h-10 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

async function ChatPageContent({ params }: PageProps) {
  await connection()

  const { applicationId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=/chat/${applicationId}`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Error membaca profil user di halaman chat:', profileError)
  }

  const role = profile?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }

  const fallbackHref = role === 'umkm' ? '/merchant/jobs' : '/student/activity'

  if (!UUID_REGEX.test(applicationId)) {
    return (
      <ChatAccessRedirect
        message="Percakapan tidak ditemukan"
        fallbackHref={fallbackHref}
      />
    )
  }

  const [contactRes, appRes, msgsRes] = await Promise.all([
    supabase.rpc('get_counterpart_contact', {
      p_application_id: applicationId,
    }),
    supabase
      .from('applications')
      .select('id, status, job_id, student_id, jobs(id, title, umkm_id)')
      .eq('id', applicationId)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, application_id, sender_id, receiver_id, body, created_at, read_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const appRow = appRes.data as ApplicationWithJobRow | null
  const jobObj = appRow
    ? Array.isArray(appRow.jobs)
      ? appRow.jobs[0] || null
      : appRow.jobs || null
    : null

  if (appRes.error) {
    console.error('Error membaca data lamaran untuk chat:', appRes.error)
  }
  if (msgsRes.error) {
    console.error('Error membaca riwayat pesan:', msgsRes.error)
  }

  const rawMessages = (msgsRes.data ?? []) as ChatMessage[]
  const initialMessages = [...rawMessages].reverse()

  if (contactRes.error) {
    if (contactRes.error.code === 'P0001') {
      console.warn('Akses chat ditolak oleh get_counterpart_contact:', contactRes.error.message)
    } else {
      console.error('Error rpc get_counterpart_contact:', contactRes.error)
    }

    // Jika lamaran pernah diterima lalu dibatalkan/no-show dan sudah memiliki riwayat pesan,
    // tetap izinkan membuka riwayat dalam mode "Percakapan ditutup".
    const isParticipant =
      Boolean(appRow && jobObj) &&
      (appRow!.student_id === user.id || jobObj!.umkm_id === user.id)
    const isClosedWithHistory =
      isParticipant &&
      appRow!.status !== 'accepted' &&
      appRow!.status !== 'pending' &&
      initialMessages.length > 0

    if (isClosedWithHistory && appRow && jobObj) {
      const counterpartId =
        appRow.student_id === user.id ? jobObj.umkm_id : appRow.student_id

      const { data: counterpartProfile, error: counterpartError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', counterpartId)
        .maybeSingle()

      if (counterpartError) {
        console.error('Error membaca nama lawan bicara:', counterpartError)
      }

      const fallbackName =
        appRow.student_id === user.id ? 'Pemilik Usaha' : 'Mahasiswa'

      return (
        <ChatRoomView
          applicationId={applicationId}
          currentUserId={user.id}
          counterpartId={counterpartId}
          counterpartName={counterpartProfile?.full_name || fallbackName}
          jobTitle={jobObj.title}
          initialStatus={appRow.status}
          initialMessages={initialMessages}
          fallbackHref={fallbackHref}
        />
      )
    }

    const toastMessage =
      contactRes.error.code === 'P0001'
        ? contactRes.error.message
        : 'Kamu tidak memiliki akses ke percakapan ini'

    return (
      <ChatAccessRedirect
        message={toastMessage}
        fallbackHref={fallbackHref}
      />
    )
  }

  if (!appRow || !jobObj) {
    return (
      <ChatAccessRedirect
        message="Percakapan tidak ditemukan"
        fallbackHref={fallbackHref}
      />
    )
  }

  const counterpartId =
    appRow.student_id === user.id ? jobObj.umkm_id : appRow.student_id

  const rawContact = contactRes.data as
    | CounterpartContactRow
    | CounterpartContactRow[]
    | null
  const contactRow = Array.isArray(rawContact) ? rawContact[0] || null : rawContact
  const counterpartName =
    contactRow?.full_name?.trim() ||
    (appRow.student_id === user.id ? 'Pemilik Usaha' : 'Mahasiswa')

  return (
    <ChatRoomView
      applicationId={applicationId}
      currentUserId={user.id}
      counterpartId={counterpartId}
      counterpartName={counterpartName}
      jobTitle={jobObj.title}
      initialStatus={appRow.status}
      initialMessages={initialMessages}
      fallbackHref={fallbackHref}
    />
  )
}

export default function ChatPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatPageContent params={params} />
    </Suspense>
  )
}
