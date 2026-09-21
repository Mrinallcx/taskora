"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ChartLineIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CONNECTORS, type ConnectorKind } from "@/src/domain/connectors"

type Cred = { kind: string; configured: boolean; last4: string }

const ICONS: Record<ConnectorKind, typeof SearchIcon> = {
  web_search: SearchIcon,
  prices: ChartLineIcon,
}

export function SettingsConnectors() {
  const [rows, setRows] = useState<Cred[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

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

  function last4(kind: string) {
    return rows.find((row) => row.kind === kind)?.last4
  }

  async function connect(kind: ConnectorKind) {
    const secret = (drafts[kind] ?? "").trim()
    if (!secret) {
      toast.error("Paste a key first")
      return
    }
    setBusy(kind)
    const response = await fetch("/api/credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, secret }),
    })
    setBusy(null)
    if (!response.ok) {
      toast.error("Could not connect")
      return
    }
    toast.success("Connected")
    setDrafts((current) => ({ ...current, [kind]: "" }))
    await load()
  }

  async function disconnect(kind: ConnectorKind) {
    setBusy(kind)
    await fetch(`/api/credentials?kind=${kind}`, { method: "DELETE" })
    setBusy(null)
    toast.success("Disconnected")
    await load()
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        These are the only keys a job can use today. Paste a search key and a
        prices key here, then turn them on at launch. The Apps catalog is
        separate and is not used on jobs yet.
      </p>
      {CONNECTORS.map((connector) => {
        const Icon = ICONS[connector.kind]
        const connected = Boolean(last4(connector.kind))
        return (
          <div
            key={connector.id}
            className="flex flex-col gap-3 rounded-lg border border-border/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{connector.name}</h3>
                    {connected ? (
                      <Badge variant="secondary">
                        Connected · ••••{last4(connector.kind)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not connected</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {connector.description}
                  </p>
                </div>
              </div>
              {connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy === connector.kind}
                  onClick={() => void disconnect(connector.kind)}
                >
                  Disconnect
                </Button>
              ) : null}
            </div>
            {!connected ? (
              <div className="flex flex-wrap gap-2 pl-12">
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="Paste API key"
                  className="min-w-48 flex-1"
                  value={drafts[connector.kind] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [connector.kind]: event.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === connector.kind}
                  onClick={() => void connect(connector.kind)}
                >
                  {busy === connector.kind ? "Connecting..." : "Connect"}
                </Button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
