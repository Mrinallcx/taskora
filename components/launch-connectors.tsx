"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { MCP_AUTH_LABELS, mcpFaviconUrl, type McpAuth } from "@/src/domain/mcp-catalog"

type SavedApp = {
  id: string
  name: string
  url: string
  auth: McpAuth
  status?: "ready" | "needs_auth"
}

function appReady(app: SavedApp) {
  if (app.status === "needs_auth") return false
  if (app.auth === "oauth" && app.status !== "ready") return false
  return true
}

function AppIcon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const src = mcpFaviconUrl(url)
  if (!src || failed) {
    return (
      <div className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[10px] font-semibold">
        {name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={24}
        height={24}
        className="size-6 object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export function LaunchConnectors({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [apps, setApps] = useState<SavedApp[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void fetch("/api/apps")
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { servers?: SavedApp[] } | null) => {
        const servers = json?.servers ?? []
        setApps(servers)
        setLoaded(true)
        onChange(servers.filter(appReady).map((app) => app.id))
      })
      .catch(() => {
        setApps([])
        setLoaded(true)
      })
    // Defaults to every ready app in My Apps on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function enabled(id: string) {
    return value.includes(id)
  }

  function setEnabled(id: string, on: boolean) {
    if (on) onChange(Array.from(new Set([...value, id])))
    else onChange(value.filter((item) => item !== id))
  }

  const [connectingId, setConnectingId] = useState<string | null>(null)

  async function startOauth(app: SavedApp) {
    setConnectingId(app.id)
    const response = await fetch("/api/apps/oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: app.id }),
    })
    const json = (await response.json()) as {
      url?: string
      error?: { message?: string }
    }
    if (!response.ok || !json.url) {
      setConnectingId(null)
      toast.error(json.error?.message ?? "Could not start sign-in")
      return
    }
    window.location.href = json.url
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Apps</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          From{" "}
          <Link
            href="/apps?tab=mine"
            className="text-primary underline-offset-4 hover:underline"
          >
            My Apps
          </Link>
          . Turn on the ones this run should use.
        </p>
      </div>
      {!loaded ? (
        <p className="text-muted-foreground text-xs">Loading apps…</p>
      ) : apps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 px-4 py-3">
          <p className="text-sm font-medium">No apps connected</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Add an app in My Apps, then it will show up here.
          </p>
          <Link
            href="/apps?tab=mine"
            className="text-primary mt-2 inline-block text-xs underline-offset-4 hover:underline"
          >
            Open My Apps
          </Link>
        </div>
      ) : (
        <div className="divide-border/40 divide-y rounded-lg border border-border/60">
          {apps.map((app) => {
            const ready = appReady(app)
            return (
              <div
                key={app.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AppIcon url={app.url} name={app.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {ready
                        ? MCP_AUTH_LABELS[app.auth]
                        : "Saved · sign-in not connected"}
                    </p>
                  </div>
                </div>
                {!ready ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0"
                    disabled={connectingId === app.id}
                    onClick={() => void startOauth(app)}
                  >
                    {connectingId === app.id ? "Connecting" : "Connect"}
                  </Button>
                ) : (
                  <Switch
                    checked={enabled(app.id)}
                    onCheckedChange={(checked) =>
                      setEnabled(app.id, Boolean(checked))
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
