export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "conflict"
  | "budget"
  | "denylist"
  | "credential_error"
  | "compute_exhausted"
  | "rate_limited"

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export function errorBody(error: ApiError | Error) {
  if (error instanceof ApiError) {
    return { error: { code: error.code, message: error.message } }
  }
  return { error: { code: "invalid" as const, message: error.message } }
}

export function statusOf(error: unknown) {
  if (error instanceof ApiError) return error.status
  return 500
}
