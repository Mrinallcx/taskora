"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { BorderBeam } from "border-beam"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { StockPicker } from "@/components/stock-picker"
import { StockWorkersAvailable } from "@/components/stock-workers-available"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  launchedAgentHref,
  type LaunchedAgentOption,
} from "@/src/domain/launched-agents"
import { briefCryptoMismatch } from "@/src/domain/crypto-scope"
import { briefStockMismatch } from "@/src/domain/stock-scope"
import {
  LAUNCH_CATEGORIES,
  isLaunchCategory,
  type LaunchCategory,
  type StockListing,
} from "@/src/domain/stock-types"

const NEW_AGENT = "new"

function BeamField({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [focused, setFocused] = useState(false)
  const light = resolvedTheme !== "dark"
  return (
    <BorderBeam
      className="w-full"
      size="md"
      colorVariant="colorful"
      strength={focused ? 1 : light ? 0.88 : 0.78}
      brightness={light ? 1.5 : 1.35}
      glowSize={1.15}
      duration={2.6}
      active
      theme={light ? "light" : "dark"}
    >
      <div
        className="bg-background rounded-xl border border-input"
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setFocused(false)
          }
        }}
      >
        {children}
      </div>
    </BorderBeam>
  )
}

function errorMessage(payload: { error?: string | { message?: string } }) {
  if (typeof payload.error === "string") return payload.error
  return payload.error?.message
}

export function LaunchAgentForm({
  merchant,
  agents = [],
}: {
  merchant?: { name: string } | null
  agents?: LaunchedAgentOption[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [onMarketplace, setOnMarketplace] = useState(false)
  const [underMerchant, setUnderMerchant] = useState(false)
  const [category, setCategory] = useState<LaunchCategory>("stocks")
  const [stocks, setStocks] = useState<StockListing[]>(agents[0]?.symbols ?? [])
  const [picked, setPicked] = useState(agents[0]?.slug ?? NEW_AGENT)
  const [name, setName] = useState(agents[0]?.name ?? "")
  const existing = agents.find((row) => row.slug === picked) ?? null

  function applyAgent(slug: string) {
    setPicked(slug)
    const agent = agents.find((row) => row.slug === slug)
    if (!agent) {
      setName("")
      setStocks([])
      return
    }
    setName(agent.name)
    if (agent.category === "crypto") {
      setCategory("crypto")
      setStocks(agent.symbols)
      return
    }
    if (agent.category === "stocks" || agent.symbols.length > 0) {
      setCategory("stocks")
      setStocks(agent.symbols)
    }
  }

  function resetLocal() {
    setOnMarketplace(false)
    setUnderMerchant(false)
    setCategory("stocks")
    setStocks([])
    setPicked(NEW_AGENT)
    setName("")
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const agentName = name.trim()
    const brief = String(data.get("brief") ?? "").trim()
    const instructions = String(data.get("instructions") ?? "").trim()
    if (!agentName) {
      toast.error("Add an agent name.")
      return
    }
    if (stocks.length === 0) {
      toast.error(
        category === "crypto"
          ? "Pick at least one crypto."
          : "Pick at least one NASDAQ-listed stock."
      )
      return
    }
    if (!brief) {
      toast.error("Add a job description.")
      return
    }
    const mismatch =
      category === "crypto"
        ? briefCryptoMismatch(brief, instructions, stocks)
        : briefStockMismatch(brief, instructions, stocks)
    if (mismatch) {
      toast.error(mismatch)
      return
    }
    setPending(true)
    try {
      const created = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          brief,
          instructions,
          category,
          symbol: stocks[0]?.symbol,
          symbols: stocks.map((row) => row.symbol),
          autoApprovePlan: true,
          budgetCents: 2000,
          isPublic: onMarketplace,
          underMerchant: Boolean(merchant) && underMerchant,
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
        toast.error(errorMessage(fail) ?? "Job created, but the agent could not start.")
        router.push(launchedAgentHref(agentName))
        return
      }
      toast.success(
        existing ? `New task is running on ${agentName}.` : "Agent is running."
      )
      form.reset()
      resetLocal()
      router.push(launchedAgentHref(agentName))
      router.refresh()
    } catch {
      toast.error("Could not launch the agent.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} onReset={resetLocal}>
      <div>
        <h2 className="font-heading text-2xl">Launch agent</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Name it, pick stocks or crypto, say what to research.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {agents.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Agent</span>
            <Select
              value={picked}
              onValueChange={(value) => {
                if (typeof value === "string") applyAgent(value)
              }}
            >
              <SelectTrigger id="job-agent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_AGENT}>New agent</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.slug} value={agent.slug}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="job-name">
            Name
          </label>
          <Input
            id="job-name"
            name="name"
            value={name}
            onChange={(event) => {
              if (!existing) setName(event.target.value)
            }}
            readOnly={Boolean(existing)}
            required
            maxLength={80}
            placeholder="Apple desk"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {category === "crypto" ? "Crypto" : "Stocks"}
          </span>
          <div className="flex items-start rounded-lg border border-input dark:bg-input/30">
            <Select
              value={category}
              onValueChange={(value) => {
                if (isLaunchCategory(value)) setCategory(value)
                setStocks([])
              }}
            >
              <SelectTrigger
                id="job-category"
                className="h-8 w-28 shrink-0 rounded-none border-0 border-r border-input dark:bg-transparent dark:hover:bg-transparent"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAUNCH_CATEGORIES.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category === "crypto" ? (
              <StockPicker
                value={stocks}
                onChange={setStocks}
                disabled={pending}
                searchPath="/api/crypto/search"
                placeholder="Search crypto…"
                fullPlaceholder="Max 4 coins"
                errorCopy="Could not search crypto."
                inputId="job-crypto"
              />
            ) : (
              <StockPicker
                value={stocks}
                onChange={setStocks}
                disabled={pending}
              />
            )}
          </div>
          {category === "crypto" ? (
            <StockWorkersAvailable endpoint="/api/crypto/workers" />
          ) : (
            <StockWorkersAvailable />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="job-brief">
            Description
          </label>
          <BeamField>
            <Textarea
              id="job-brief"
              name="brief"
              required
              rows={4}
              maxLength={8000}
              className="min-h-28 field-sizing-fixed rounded-xl border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
              placeholder={
                category === "crypto"
                  ? "Research Bitcoin (BTC) over the last 24 months."
                  : "Compare AAPL and MSFT since 2020."
              }
            />
          </BeamField>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="job-instructions">
            Instructions
          </label>
          <BeamField>
            <Textarea
              id="job-instructions"
              name="instructions"
              rows={4}
              maxLength={8000}
              className="min-h-28 field-sizing-fixed rounded-xl border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
              placeholder={
                category === "crypto"
                  ? "Cite primary sources. Stay on the selected coins only."
                  : "Cite 10-Ks. No invented figures."
              }
            />
          </BeamField>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Show on marketplace</span>
          <Switch
            id="job-marketplace"
            checked={onMarketplace}
            onCheckedChange={setOnMarketplace}
            disabled={pending}
          />
        </label>
        {merchant ? (
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Register under {merchant.name}</span>
            <Switch
              id="job-merchant"
              checked={underMerchant}
              onCheckedChange={setUnderMerchant}
              disabled={pending}
            />
          </label>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Starting…" : "Launch"}
        </Button>
        <Button type="reset" variant="ghost" size="sm" disabled={pending}>
          Clear
        </Button>
      </div>
    </form>
  )
}
