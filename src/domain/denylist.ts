const PHRASES = [
  "medical-diagnosis",
  "write-a-prescription",
  "insider-trading",
  "buy/sell-this-stock-now",
  "draft-court-filing-as-counsel",
]

export function denylistHit(brief: string) {
  const text = brief.toLowerCase()
  return PHRASES.some((phrase) => text.includes(phrase))
}
