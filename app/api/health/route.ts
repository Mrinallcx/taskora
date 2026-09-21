import { NextResponse } from "next/server"

import { connect } from "@/src/db/connect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await connect()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "db" },
      { status: 500 }
    )
  }
}
