import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// This is a retired endpoint.
// Students must submit answers to a specific active Pulse.
export async function POST() {
  return NextResponse.json(
    {
      error:
        'This endpoint is no longer supported. Please submit your answer to an active Pulse.',
    },
    { status: 410 }
  )
}