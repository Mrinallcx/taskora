import { Job, Snapshot } from "@/src/db/models"
import { tokenCents } from "@/src/domain/compute"
import { chargeCompute } from "@/src/domain/jobs"
import { pickEvidenceSnapshots } from "@/src/domain/evidence"
import { proposedFromModel, repairCitations } from "@/src/domain/citations"
import {
  evalSchema,
  leadSchema,
  notesSchema,
  reportSchema,
  scopeSchema,
} from "@/src/agent/schemas"
import type { AgentInput } from "@/src/agent/types"
import { hex } from "@/src/lib/ids"
import { parseSkills } from "@/src/domain/skills"

function schemaFor(type: string) {
  if (type === "plan") return leadSchema
  if (type === "scope") return scopeSchema
  if (type === "sources" || type === "findings") return notesSchema
  if (type === "report") return reportSchema
  if (type === "evaluate") return evalSchema
  throw new Error(`Unknown task type ${type}`)
}

function schemaHint(type: string) {
  if (type === "plan") {
    return `{
  "tasks": [
    {"type":"scope","acceptance":"...","listingSlug":"worker-research"},
    {"type":"sources","listingSlug":"worker-research"},
    {"type":"findings","listingSlug":"worker-research"},
    {"type":"report","listingSlug":"worker-research"}
  ],
  "proposedListingSlugs": ["worker-research","eval-research"],
  "estimatedCostCents": 2000,
  "questions": []
}`
  }
  if (type === "scope") {
    return `{ "questions": string[], "inclusions": string[], "exclusions": string[], "acceptance": string[] }`
  }
  if (type === "sources" || type === "findings") {
    return `{ "notes": string, "citations": [{"snapshotId": string, "url": string, "quote": string, "sourceClass": "web"|"price"}] }`
  }
  if (type === "report") {
    return `{ "markdown": string, "citationIds": string[] }

markdown answers the brief. Use this shape:
# MEMO: {short title}
## Executive summary
Then one ## heading per question the brief asked. Do not add encyclopedia sections the brief did not ask.
If Evidence has a yearly price table, copy it as a markdown table. Do not invent years or prices.
Names, dates, and figures only when they appear in Evidence. If a requested dimension is missing, say so.
Cite claims with markdown [label](url) from SOURCE_DOCUMENTs.
## Sources
- 1. url — short quote from that source
Cite only SOURCE_DOCUMENTs you used. Do not invent URLs or snapshot ids. Minimum 5 valid quotes.`
  }
  return `{
  "scores": {"brief_coverage":0-100,"citation_quality":0-100,"accuracy_tells":0-100,"structure":0-100,"uncertainty":0-100},
  "pass": boolean,
  "hardFails": [],
  "comments": string
}`
}

function messageText(content: unknown) {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : String((part as { text?: string })?.text ?? "")))
      .join("")
  }
  return ""
}

function coerce(type: string, data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data
  const row = data as Record<string, unknown>
  if (type === "plan") {
    return {
      tasks: row.tasks,
      proposedListingSlugs: row.proposedListingSlugs ?? row.proposed_listing_slugs,
      estimatedCostCents: Number(row.estimatedCostCents ?? row.estimated_cost_cents),
      questions: Array.isArray(row.questions) ? row.questions : [],
    }
  }
  if (type === "scope") {
    return {
      questions: row.questions ?? [],
      inclusions: row.inclusions ?? [],
      exclusions: row.exclusions ?? [],
      acceptance: row.acceptance ?? [],
    }
  }
  if (type === "sources" || type === "findings") {
    return {
      notes: String(row.notes ?? ""),
      citations: row.citations ?? [],
    }
  }
  if (type === "report") {
    return {
      markdown: String(row.markdown ?? ""),
      citationIds: row.citationIds ?? row.citation_ids ?? [],
      citations: row.citations ?? [],
    }
  }
  const scores = (row.scores ?? {}) as Record<string, unknown>
  return {
    scores: {
      brief_coverage: Number(scores.brief_coverage),
      citation_quality: Number(scores.citation_quality),
      accuracy_tells: Number(scores.accuracy_tells),
      structure: Number(scores.structure),
      uncertainty: Number(scores.uncertainty),
    },
    pass: Boolean(row.pass),
    hardFails: [],
    comments: String(row.comments ?? ""),
  }
}

type GptOssReasoning = "low" | "medium" | "high"

/** gpt-oss-120b rejects `none` with HTTP 400. */
const REASONING_EFFORT: GptOssReasoning = "low"

async function complete(
  messages: { role: string; content: string }[],
  opts: { maxTokens: number; reasoning: GptOssReasoning }
) {
  const key = process.env.CEREBRAS_API_KEY
  if (!key) throw new Error("CEREBRAS_API_KEY is not set")
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-oss-120b",
      messages,
      response_format: { type: "json_object" },
      reasoning_effort: opts.reasoning,
      max_tokens: opts.maxTokens,
    }),
  })
  if (!response.ok) {
    throw new Error(`Cerebras ${response.status} ${await response.text()}`)
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const content = messageText(json.choices?.[0]?.message?.content)
  const usage = json.usage ?? {}
  return {
    content,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  }
}

function parseJson(content: string) {
  const trimmed = content.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  const body = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
  return JSON.parse(body) as unknown
}

async function loadEvidenceSnapshots(jobId: unknown) {
  const snapshots = await Snapshot.find({ jobId }).sort({ createdAt: 1 })
  return pickEvidenceSnapshots(snapshots, 20)
}

export async function runCerebrasAgent(input: AgentInput) {
  const job = await Job.findById(input.jobId)
  if (!job) throw new Error("Job not found")
  const snapshots = await loadEvidenceSnapshots(job._id)
  const sources = snapshots
    .map(
      (row) =>
        `<SOURCE_DOCUMENT id="${hex(row._id)}" url="${row.url}">\n${row.text.slice(0, 4000)}\n</SOURCE_DOCUMENT>`
    )
    .join("\n\n")

  const description = input.summary?.trim()
  const instructions = input.instructions?.trim()
  const skills = parseSkills(input.skills)
  const workerSkills = parseSkills(input.workerSkills)
  const system = [
    `You are a ${input.kind} research agent. Research is always in-depth.`,
    description ? `Agent description:\n${description}` : "",
    skills.length ? `Your skills (use these on this job):\n${skills.join(", ")}` : "",
    input.type === "evaluate" && workerSkills.length
      ? `Worker skills the memo must demonstrate:\n${workerSkills.join(", ")}`
      : "",
    instructions ? `Agent instructions (follow these):\n${instructions}` : "",
    input.type === "evaluate" && (skills.length || workerSkills.length)
      ? "In comments, say how the memo did on each listed skill. Fail brief_coverage if a required worker skill is missing from the memo."
      : "",
    `Reply with JSON only. Match this shape exactly, no extra keys:\n${schemaHint(input.type)}`,
  ]
    .filter(Boolean)
    .join("\n\n")
  const user = [
    `Brief: ${job.brief}`,
    job.instructions?.trim()
      ? `Research instructions:\n${job.instructions.trim()}`
      : "",
    `Domain: ${job.domain}`,
    `BudgetCents: ${job.budgetCents}`,
    `Task: ${input.type}`,
    `Round: ${input.round}`,
    sources ? `Evidence:\n${sources}` : "No snapshots yet.",
    input.type === "evaluate"
      ? [
          input.memo?.trim()
            ? `Memo to grade:\n<MEMO>\n${input.memo.slice(0, 24000)}\n</MEMO>`
            : "Memo to grade: (empty)",
          "Score THIS memo against the brief and Evidence. hardFails must be []. Citation checks are done in code, not by you.",
        ].join("\n")
      : "",
    input.type === "report"
      ? "Write the memo from Evidence. Answer every part of the brief in its own section. Prefer primary/official and critical sources over education explainers. Copy any yearly price table from a price SOURCE_DOCUMENT into the memo. citationIds must be snapshot ids from Evidence you actually used. Cite at least 5 distinct ids. Cite sources in the body with markdown links. Quotes must be substrings of the source text. If the domain is finance and you mention dollars, percents, or market cap, you must also use a price SOURCE_DOCUMENT (crypto_quote or price_quote)."
      : "",
    input.type === "sources" || input.type === "findings"
      ? `Cite at least 5 snapshots you used. snapshotId must be one of: ${snapshots.map((row) => hex(row._id)).join(", ") || "(none yet)"}. quote must appear in that snapshot text.`
      : "",
    input.type === "plan"
      ? [
          input.catalog ?? "",
          "Propose only slugs from the hire catalog. Set listingSlug on each worker task. Include one evaluator slug in proposedListingSlugs. estimatedCostCents must be <= budget.",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n")

  const schema = schemaFor(input.type)
  let lastError: unknown
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
  const maxTokens = input.type === "report" ? 32768 : 4096
  const reasoning: GptOssReasoning = input.type === "report" ? "low" : REASONING_EFFORT
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await complete(messages, { maxTokens, reasoning })
    await chargeCompute(
      job._id,
      tokenCents(result.inputTokens, result.outputTokens)
    )
    try {
      const parsed = coerce(input.type, parseJson(result.content)) as Record<string, unknown>
      if (input.type === "sources" || input.type === "findings" || input.type === "report") {
        const citations = repairCitations(
          proposedFromModel({
            citations: parsed.citations as { snapshotId?: string; url?: string; quote?: string; sourceClass?: string }[],
            citationIds: parsed.citationIds as string[],
          }),
          snapshots.map((row) => ({
            id: hex(row._id),
            url: row.url,
            text: row.text,
            toolName: row.toolName,
          })),
          5
        )
        parsed.citations = citations
        if (citations.length < 5) {
          throw new Error("Need at least 5 citable quotes from Evidence")
        }
        if (input.type === "report") {
          parsed.citationIds = citations.map((row) => row.snapshotId)
          const markdown = String(parsed.markdown ?? "")
          if (markdown.trim().length < 400) {
            throw new Error("Report markdown is too short")
          }
        }
      }
      if (input.type === "evaluate") {
        const scores = parsed.scores as Record<string, number>
        parsed.scores = {
          brief_coverage: Number(scores.brief_coverage || 0),
          citation_quality: Number(scores.citation_quality || 0),
          accuracy_tells: Number(scores.accuracy_tells || 0),
          structure: Number(scores.structure || 0),
          uncertainty: Number(scores.uncertainty || 0),
        }
        parsed.hardFails = []
        parsed.pass = Boolean(parsed.pass)
      }
      return schema.parse(parsed)
    } catch (error) {
      lastError = error
      messages.push({
        role: "assistant",
        content: result.content,
      })
      messages.push({
        role: "user",
        content: `Schema parse failed: ${error instanceof Error ? error.message : String(error)}. Return corrected JSON only.`,
      })
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Cerebras schema parse failed")
}
