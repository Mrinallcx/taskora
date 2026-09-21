import { describe, expect, it } from "vitest"

import { fetchValidated } from "@/src/tools/ssrf"
import { isBlockedIp } from "@/src/tools/net"

describe("SSRF", () => {
  it("P2-TOOL-03 blocks private and file schemes", async () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true)
    expect(isBlockedIp("10.1.2.3")).toBe(true)
    expect(isBlockedIp("192.168.0.9")).toBe(true)
    expect(isBlockedIp("169.254.169.254")).toBe(true)
    const file = await fetchValidated("file:///etc/passwd")
    expect(file.ok).toBe(false)
    if (!file.ok) expect(file.code).toBe("ssrf_blocked")
  })

  it("P2-TOOL-06 blocks a hostname whose DNS is loopback", async () => {
    const result = await fetchValidated("http://attacker.example/", {
      lookupFn: async () => [{ address: "127.0.0.1", family: 4 }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("ssrf_blocked")
  })

  it("P2-TOOL-07 blocks a public URL that redirects to link-local", async () => {
    const result = await fetchValidated("http://public.example/page", {
      lookupFn: async (host) => {
        if (host === "public.example") return [{ address: "1.2.3.4", family: 4 }]
        return [{ address: "169.254.169.254", family: 4 }]
      },
      transport: async ({ url }) => {
        if (url.hostname === "public.example") {
          return {
            status: 302,
            headers: { location: "http://evil.example/meta" },
            body: Buffer.from(""),
          }
        }
        throw new Error("should not fetch private hop")
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("ssrf_blocked")
  })
})
