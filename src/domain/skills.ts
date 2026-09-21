export function parseSkills(raw?: string | null) {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[,;|/]+/)) {
    const token = part.trim().toLowerCase().replace(/\s+/g, " ")
    if (token.length < 2 || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out.slice(0, 12)
}

export function skillOverlap(need: string[], have: string[]) {
  if (need.length === 0 || have.length === 0) return 0
  const set = new Set(have)
  return need.filter((skill) => set.has(skill)).length
}

export function bestSkillMatch<T extends { skills?: string | null }>(
  need: string[],
  candidates: T[]
) {
  if (need.length === 0) return null
  let best: T | null = null
  let score = 0
  for (const row of candidates) {
    const hits = skillOverlap(need, parseSkills(row.skills))
    if (hits > score) {
      score = hits
      best = row
    }
  }
  return score > 0 ? best : null
}

export function needFromBrief(brief: string, extraSkills?: string | null) {
  const tagged = parseSkills(extraSkills)
  const seen = new Set(tagged)
  const out = [...tagged]
  const words = brief.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []
  for (const word of words) {
    if (seen.has(word)) continue
    seen.add(word)
    out.push(word)
    if (out.length >= 24) break
  }
  return out
}

export function rankBySkill<T extends { skills?: string | null }>(
  need: string[],
  candidates: T[],
  limit: number
) {
  return [...candidates]
    .map((row) => ({
      row,
      score: skillOverlap(need, parseSkills(row.skills)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.row)
}
