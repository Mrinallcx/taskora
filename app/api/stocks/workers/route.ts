import { NextResponse } from "next/server"

import { stockWorkersAvailableCopy } from "@/src/domain/stock-workers"
import { stockWorkerAvailability } from "@/src/domain/stock-worker-runtime"
import { jsonError } from "@/src/lib/http"
import { getSessionUser } from "@/src/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await getSessionUser(request)
    const availability = await stockWorkerAvailability()
    return NextResponse.json({
      ...availability,
      copy: stockWorkersAvailableCopy(availability.available),
    })
  } catch (error) {
    return jsonError(error)
  }
}
