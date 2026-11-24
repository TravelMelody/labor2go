import { connection } from 'next/server'

export async function GET() {
  await connection()
  return Response.json({
    server_time: new Date().toISOString(),
  })
}
