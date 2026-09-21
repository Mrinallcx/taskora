"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

function errorMessage(payload: { error?: string | { message?: string } }) {
  if (typeof payload.error === "string") return payload.error
  return payload.error?.message
}

export function LaunchAgentForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const brief = String(data.get("brief") ?? "").trim()
    const instructions = String(data.get("instructions") ?? "").trim()
    if (!brief) {
      toast.error("Add a job description.")
      return
    }
    setPending(true)
    try {
      const created = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          instructions,
          autoApprovePlan: true,
          budgetCents: 2000,
        }),
      })
      const json = (await created.json()) as {
        id?: string
        error?: string | { message?: string }
      }
      if (!created.ok || !json.id) {
        toast.error(errorMessage(json) ?? "Could not create the job.")
        return
      }
      const funded = await fetch(`/api/jobs/${json.id}/fund`, { method: "POST" })
      if (!funded.ok) {
        const fail = (await funded.json()) as {
          error?: string | { message?: string }
        }
        toast.error(errorMessage(fail) ?? "Job created, but it could not start.")
        router.push(`/dashboard/${json.id}`)
        return
      }
      toast.success("Research started.")
      form.reset()
      router.push(`/dashboard/${json.id}`)
      router.refresh()
    } catch {
      toast.error("Could not launch research.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <h2 className="font-heading text-3xl">Launch research</h2>
      <p className="text-muted-foreground text-sm">
        Job description is the question. Research instructions tell it how to
        search, cite, and structure the memo.
      </p>
      <FieldGroup className="gap-3">
        <Field className="gap-1">
          <FieldLabel htmlFor="job-brief">Job description</FieldLabel>
          <FieldDescription>What should be researched.</FieldDescription>
          <Textarea
            id="job-brief"
            name="brief"
            required
            rows={6}
            maxLength={8000}
            className="min-h-28 field-sizing-fixed"
            placeholder="How has Solana’s market changed since 2020: price path, FTX, outages, holders, demand through 2027. Use CoinGecko and primary sources."
          />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="job-instructions">Research instructions</FieldLabel>
          <FieldDescription>
            How to research: sources, structure, tables, tone. Optional but better
            memos come from a tight brief here.
          </FieldDescription>
          <Textarea
            id="job-instructions"
            name="instructions"
            rows={8}
            maxLength={8000}
            className="min-h-36 field-sizing-fixed"
            placeholder={`Use live price sources (CoinGecko or similar). Cite official or primary write-ups plus at least one critical or risk-focused source. Include a short yearly price or market-cap table. Write markdown. Do not invent figures.`}
          />
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Launching" : "Launch"}
        </Button>
        <Button type="reset" variant="outline" size="sm" disabled={pending}>
          Clear
        </Button>
      </div>
    </form>
  )
}
