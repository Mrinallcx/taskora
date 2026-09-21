"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Cred = { kind: string; configured: boolean; last4: string }

export function SettingsCredentials() {
  const [rows, setRows] = useState<Cred[]>([])

  async function load() {
    const response = await fetch("/api/credentials")
    if (response.ok) {
      const json = await response.json()
      setRows(json.credentials ?? [])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(kind: "web_search" | "prices", secret: string) {
    const response = await fetch("/api/credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, secret }),
    })
    if (!response.ok) {
      toast.error("Could not save key")
      return
    }
    toast.success("Saved")
    await load()
  }

  async function remove(kind: string) {
    await fetch(`/api/credentials?kind=${kind}`, { method: "DELETE" })
    await load()
  }

  function last4(kind: string) {
    return rows.find((row) => row.kind === kind)?.last4
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const search = String(data.get("web_search") ?? "")
        const prices = String(data.get("prices") ?? "")
        if (search) await save("web_search", search)
        if (prices) await save("prices", prices)
        event.currentTarget.reset()
      }}
    >
      <div className="divide-border/40 divide-y rounded-lg border border-border/60">
        <div className="space-y-2 p-4">
          <div>
            <Label htmlFor="web_search" className="text-sm font-medium">
              Web search key
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Used when a job searches the web with your key
              {last4("web_search") ? ` · saved ••••${last4("web_search")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              id="web_search"
              name="web_search"
              type="password"
              autoComplete="off"
              className="min-w-48 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!last4("web_search")}
              onClick={() => void remove("web_search")}
            >
              Delete
            </Button>
          </div>
        </div>
        <div className="space-y-2 p-4">
          <div>
            <Label htmlFor="prices" className="text-sm font-medium">
              Prices key
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Used when a job needs live market figures
              {last4("prices") ? ` · saved ••••${last4("prices")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              id="prices"
              name="prices"
              type="password"
              autoComplete="off"
              className="min-w-48 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!last4("prices")}
              onClick={() => void remove("prices")}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
      <Button type="submit" size="sm">
        Save keys
      </Button>
    </form>
  )
}
