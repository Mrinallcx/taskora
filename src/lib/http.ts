import { NextResponse } from "next/server"

import { errorBody, statusOf } from "@/src/domain/errors"

export function jsonError(error: unknown) {
  return NextResponse.json(errorBody(error as Error), { status: statusOf(error) })
}
