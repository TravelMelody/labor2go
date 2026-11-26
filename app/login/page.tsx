import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'

interface LoginPageProps {
  searchParams: Promise<{
    mode?: string
    redirectTo?: string
    error?: string
  }>
}

async function LoginRedirectContent({ searchParams }: LoginPageProps) {
  await connection()

  const resolved = await searchParams
  const params = new URLSearchParams()
  params.set('auth', resolved.mode === 'signup' ? 'signup' : 'signin')

  if (
    typeof resolved.redirectTo === 'string' &&
    resolved.redirectTo.startsWith('/') &&
    !resolved.redirectTo.startsWith('//')
  ) {
    params.set('redirectTo', resolved.redirectTo)
  }

  if (typeof resolved.error === 'string' && resolved.error.trim()) {
    params.set('error', resolved.error)
  }

  return redirect(`/?${params.toString()}`)
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FF]">
          <div className="w-6 h-6 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginRedirectContent searchParams={searchParams} />
    </Suspense>
  )
}
