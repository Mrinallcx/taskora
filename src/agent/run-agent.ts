import { runFakeAgent } from "@/src/agent/fake"
import { runCerebrasAgent } from "@/src/agent/cerebras"
import {
  evalSchema,
  leadSchema,
  notesSchema,
  reportSchema,
  scopeSchema,
} from "@/src/agent/schemas"
import type { AgentInput } from "@/src/agent/types"

export type { AgentInput }

export async function runAgent(input: AgentInput) {
  const provider = process.env.AGENT_PROVIDER === "cerebras" ? "cerebras" : "fake"
  const raw =
    provider === "cerebras"
      ? await runCerebrasAgent(input)
      : await runFakeAgent(input)

  if (input.type === "plan") return leadSchema.parse(raw)
  if (input.type === "scope") return scopeSchema.parse(raw)
  if (input.type === "sources" || input.type === "findings") {
    return notesSchema.parse(raw)
  }
  if (input.type === "report") return reportSchema.parse(raw)
  if (input.type === "evaluate") return evalSchema.parse(raw)
  return raw
}
