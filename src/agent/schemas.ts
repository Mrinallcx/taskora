import { z } from "zod"

export const leadSchema = z
  .object({
    tasks: z.array(
      z.object({
        type: z.string(),
        acceptance: z.string().optional(),
        listingSlug: z.string().optional(),
      })
    ),
    proposedListingSlugs: z.array(z.string()),
    estimatedCostCents: z.number(),
    questions: z.array(z.string()).default([]),
  })
  .strict()

export const scopeSchema = z
  .object({
    questions: z.array(z.string()),
    inclusions: z.array(z.string()),
    exclusions: z.array(z.string()),
    acceptance: z.array(z.string()),
  })
  .strict()

export const notesSchema = z
  .object({
    notes: z.string(),
    citations: z.array(z.object({ snapshotId: z.string().optional(), url: z.string(), quote: z.string().optional(), sourceClass: z.string() })),
  })
  .strict()

export const reportSchema = z
  .object({
    markdown: z.string(),
    citationIds: z.array(z.string()),
  })
  .passthrough()

export const evalSchema = z
  .object({
    scores: z.object({
      brief_coverage: z.number(),
      citation_quality: z.number(),
      accuracy_tells: z.number(),
      structure: z.number(),
      uncertainty: z.number(),
    }),
    pass: z.boolean(),
    hardFails: z.array(z.string()).default([]),
    comments: z.string().default(""),
  })
  .strict()
