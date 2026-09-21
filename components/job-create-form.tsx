"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LaunchConnectors } from "@/components/launch-connectors"
import { Textarea } from "@/components/ui/textarea"

const TOOLS: Record<string, string[]> = {
  general: ["web_search", "fetch_page", "crypto_quote"],
  finance: ["web_search", "fetch_page", "sec_search", "sec_filing", "price_quote"],
  academic: ["web_search", "fetch_page", "paper_search", "paper_get"],
}

export function JobCreateForm() {
  const router = useRouter()
  const [domain, setDomain] = useState("general")
  const [pending, setPending] = useState(false)
  const [useAppIds, setUseAppIds] = useState<string[]>([])
  const tools = useMemo(() => TOOLS[domain] ?? [], [domain])

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        setPending(true)
        try {
          const response = await fetch("/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brief: String(data.get("brief") ?? ""),
              domain,
              budgetCents: Number(String(data.get("budgetCents") ?? "2000")),
              useAppIds,
            }),
          })
          const json = await response.json()
          if (!response.ok) {
            toast.error(json.error?.message ?? "Could not create job")
            return
          }
          router.push(`/dashboard/${json.id}`)
        } finally {
          setPending(false)
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>Brief</FieldLabel>
          <Textarea name="brief" required rows={6} placeholder="History of the tea trade, last 20 years" />
        </Field>
        <Field>
          <FieldLabel>Domain</FieldLabel>
          <Select value={domain} onValueChange={(value) => value && setDomain(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="academic">Academic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Budget (cents, 2000–10000)</FieldLabel>
          <Input name="budgetCents" type="number" min={2000} max={10000} defaultValue={2000} />
        </Field>
        <p className="text-muted-foreground text-sm">Tools: {tools.join(", ")}</p>
        <LaunchConnectors value={useAppIds} onChange={setUseAppIds} />
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create job"}
      </Button>
    </form>
  )
}
