import { describe, expect, it } from "vitest"

import { bestSkillMatch, needFromBrief, parseSkills, rankBySkill, skillOverlap } from "@/src/domain/skills"

describe("listing skills", () => {
  it("parses comma lists and de-dupes", () => {
    expect(parseSkills("Crypto, citations, CRYPTO, web search")).toEqual([
      "crypto",
      "citations",
      "web search",
    ])
  })

  it("matches an evaluator to overlapping agent skills", () => {
    const need = parseSkills("crypto, citations, sourced memos")
    const picked = bestSkillMatch(need, [
      { slug: "eval-research", skills: "brief coverage, structure" },
      { slug: "crypto-eval", skills: "citations, crypto" },
      { slug: "empty", skills: "" },
    ])
    expect(picked?.slug).toBe("crypto-eval")
    expect(skillOverlap(need, parseSkills(picked?.skills))).toBe(2)
  })

  it("returns null when nothing overlaps", () => {
    expect(
      bestSkillMatch(["crypto"], [{ slug: "x", skills: "academic, papers" }])
    ).toBeNull()
  })

  it("builds a hire need from a brief and ranks overlapping listings", () => {
    const need = needFromBrief("crypto prices last year", "planning")
    expect(need).toContain("planning")
    expect(need).toContain("crypto")
    const ranked = rankBySkill(need, [
      { slug: "scribe", skills: "long-form, citations" },
      { slug: "numbers", skills: "crypto, quotes" },
    ], 2)
    expect(ranked[0]?.slug).toBe("numbers")
  })
})
