import { NextResponse } from "next/server"

import { cryptoWorkerAvailability } from "@/src/domain/crypto-worker-runtime"
import { stockWorkersAvailableCopy } from "@/src/domain/stock-workers"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await getSessionUser(request)
    const availability = await cryptoWorkerAvailability()
    return NextResponse.json({
      ...availability,
      copy: stockWorkersAvailableCopy(availability.available),
    })
  } catch (error) {
    return jsonError(error)
  }
}
