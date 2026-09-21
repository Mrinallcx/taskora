import { describe, expect, it } from "vitest"

import { transition } from "@/src/domain/job-machine"

describe("P0-API-02 job machine", () => {
  it("rejects illegal jumps", () => {
    expect(() => transition("draft", "accept")).toThrow(/Illegal job transition/)
  })

  it("funds then plans in two legal steps", () => {
    expect(transition("draft", "fund")).toBe("funded")
    expect(transition("funded", "planning")).toBe("planning")
  })
})
