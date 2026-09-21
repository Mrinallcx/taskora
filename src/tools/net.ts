export function isBlockedIp(ip: string): boolean {
  const mapped = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip
  if (mapped === "::1" || mapped === "0:0:0:0:0:0:0:1") return true
  if (mapped.includes(":")) {
    const first = mapped.split(":")[0] ?? ""
    if (first.toLowerCase().startsWith("fc") || first.toLowerCase().startsWith("fd")) {
      return true
    }
    if (first.toLowerCase().startsWith("fe8") || first.toLowerCase().startsWith("fe9")) {
      return true
    }
    return false
  }
  const parts = mapped.split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true
  const [a, b] = parts
  if (a === 127 || a === 0 || a === 10) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}
