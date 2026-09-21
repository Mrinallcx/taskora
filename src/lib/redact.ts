export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/(sk-|key_|Bearer |api[_-]?key=)\S+/gi, "[redacted]")
  }
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        /secret|key|token|password|ciphertext/i.test(key)
          ? "[redacted]"
          : redact(nested),
      ])
    )
  }
  return value
}
