"use client"

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowUpRightIcon,
  BlocksIcon,
  CheckIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  MCP_AUTH_LABELS,
  MCP_CATALOG,
  MCP_CATEGORIES,
  catalogItemForUrl,
  featuredMcpApps,
  mcpDescription,
  mcpFaviconUrl,
  normalizeMcpUrl,
  type McpAuth,
  type McpCatalogItem,
  type McpCategory,
} from "@/src/domain/mcp-catalog"

type AppsTab = "browse" | "mine"
type CustomAuth = "open" | "apikey" | "header"

type ConnectedServer = {
  id: string
  name: string
  url: string
  auth: McpAuth
  category: string
  maintainer: string
  custom: boolean
  last4?: string
  status?: "ready" | "needs_auth"
}

function isAppsTab(value: string | null): value is AppsTab {
  return value === "browse" || value === "mine" || value === "my-servers"
}

function tabFromParam(value: string | null): AppsTab {
  if (value === "mine" || value === "my-servers") return "mine"
  return "browse"
}

function ServiceIcon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const src = mcpFaviconUrl(url)
  if (!src || failed) {
    return (
      <div className="bg-muted text-foreground flex size-8 items-center justify-center overflow-hidden rounded-lg text-[10px] font-semibold">
        {name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden">
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

function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode
  tone?: "muted" | "secondary"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone === "secondary"
          ? "bg-secondary/50 text-secondary-foreground ring-secondary-foreground/10"
          : "bg-muted text-muted-foreground ring-muted-foreground/10"
      )}
    >
      {children}
    </span>
  )
}

function CountPill({ value }: { value: number }) {
  return (
    <span className="text-muted-foreground/50 bg-muted/50 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
      {value}
    </span>
  )
}

function CategoryPills({
  value,
  onChange,
}: {
  value: McpCategory
  onChange: (id: McpCategory) => void
}) {
  return (
    <div className="relative">
      <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MCP_CATEGORIES.map((item) => {
          const active = value === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "h-7 shrink-0 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent" />
    </div>
  )
}

function CatalogCard({
  item,
  state,
  isAdding,
  onAdd,
  onConnect,
}: {
  item: McpCatalogItem
  state: "none" | "saved" | "ready"
  isAdding: boolean
  onAdd: (item: McpCatalogItem) => void
  onConnect?: (item: McpCatalogItem) => void
}) {
  const catLabel =
    MCP_CATEGORIES.find((entry) => entry.id === item.category)?.label ??
    item.category
  return (
    <div className="group bg-card/50 hover:border-primary/30 flex h-full flex-col rounded-xl border border-border/60 shadow-none transition-all duration-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <ServiceIcon url={item.maintainerUrl || item.url} name={item.name} />
        {state === "ready" ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="size-3" />
            Added
          </span>
        ) : state === "saved" ? (
          <button
            type="button"
            onClick={() => onConnect?.(item)}
            disabled={isAdding}
            aria-label={`Connect ${item.name}`}
            className="text-primary hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isAdding ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : null}
            {isAdding ? "Connecting" : "Connect"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAdd(item)}
            disabled={isAdding}
            aria-label={`Add ${item.name}`}
            className="text-muted-foreground hover:text-primary hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isAdding ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <PlusIcon className="size-3" />
            )}
            {isAdding ? "Adding" : "Add"}
          </button>
        )}
      </div>
      <h3 className="group-hover:text-primary mt-2 ml-5 line-clamp-1 text-sm font-medium transition-colors">
        {item.name}
      </h3>
      <p className="text-muted-foreground mt-1 line-clamp-2 min-h-8 px-4 text-xs leading-snug">
        {mcpDescription(item)}
      </p>
      <div className="mt-auto flex flex-1 flex-col justify-between gap-2 px-4 pt-2 pb-4">
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Chip tone="secondary">{catLabel}</Chip>
          <Chip>{MCP_AUTH_LABELS[item.auth]}</Chip>
        </div>
        <a
          href={item.maintainerUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="text-muted-foreground hover:text-foreground mt-3 flex w-fit items-center gap-1 text-xs transition-colors"
        >
          {item.maintainer}
          <ArrowUpRightIcon className="size-3" />
        </a>
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 p-4">
      <Skeleton className="size-8 rounded-lg" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  )
}

function AppsContent({
  embedded,
  tabParam,
}: {
  embedded: boolean
  tabParam: "tab" | "view"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get(tabParam)
  const tab = tabFromParam(isAppsTab(requested) ? requested : "browse")
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const [category, setCategory] = useState<McpCategory>("all")
  const [servers, setServers] = useState<ConnectedServer[]>([])
  const [loading, setLoading] = useState(true)
  const [addingUrl, setAddingUrl] = useState<string | null>(null)
  const [oauthTarget, setOauthTarget] = useState<McpCatalogItem | null>(null)
  const [apiKeyTarget, setApiKeyTarget] = useState<McpCatalogItem | null>(null)
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({})
  const [showCustom, setShowCustom] = useState(false)
  const [customForm, setCustomForm] = useState({
    name: "",
    url: "",
    auth: "open" as CustomAuth,
    secret: "",
    headerName: "Authorization",
  })

  async function load() {
    const response = await fetch("/api/apps")
    if (response.ok) {
      const json = await response.json()
      setServers(json.servers ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const oauthNote = useRef(false)
  useEffect(() => {
    const result = searchParams.get("oauth")
    if (!result || oauthNote.current) return
    oauthNote.current = true
    if (result === "connected") toast.success("Connected")
    if (result === "error") toast.error("Could not complete sign-in")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("oauth")
    const suffix = params.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  async function startOauth(server: ConnectedServer) {
    setAddingUrl(server.url)
    const response = await fetch("/api/apps/oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: server.id }),
    })
    const json = (await response.json()) as {
      url?: string
      error?: { message?: string }
    }
    if (!response.ok || !json.url) {
      setAddingUrl(null)
      toast.error(json.error?.message ?? "Could not start sign-in")
      return
    }
    window.location.href = json.url
  }

  function connectCatalogItem(item: McpCatalogItem) {
    const server = servers.find(
      (row) => normalizeMcpUrl(row.url) === normalizeMcpUrl(item.url)
    )
    if (server) void startOauth(server)
  }

  function setTab(next: AppsTab) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "browse") params.delete(tabParam)
    else params.set(tabParam, "mine")
    const suffix = params.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false })
  }

  function cardState(url: string): "none" | "saved" | "ready" {
    const server = servers.find(
      (row) => normalizeMcpUrl(row.url) === normalizeMcpUrl(url)
    )
    if (!server) return "none"
    if (server.status === "needs_auth" || server.auth === "oauth") {
      return server.status === "ready" ? "ready" : "saved"
    }
    return "ready"
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return MCP_CATALOG.filter((item) => {
      if (category !== "all" && item.category !== category) return false
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        item.maintainer.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      )
    })
  }, [category, query])

  const featured = featuredMcpApps()

  async function saveApp(payload: {
    name: string
    url: string
    auth: McpAuth
    secret?: string
    headerName?: string
    category?: string
    maintainer?: string
    custom?: boolean
  }) {
    setAddingUrl(normalizeMcpUrl(payload.url))
    const response = await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setAddingUrl(null)
    if (!response.ok) {
      toast.error("Could not add app")
      return false
    }
    toast.success(
      payload.auth === "oauth"
        ? `${payload.name} saved. Sign-in is not connected yet.`
        : `${payload.name} added`
    )
    await load()
    setTab("mine")
    return true
  }

  async function addCatalogItem(item: McpCatalogItem) {
    if (item.auth === "apikey") {
      setApiKeyTarget(item)
      setApiKeyValues({})
      return
    }
    if (item.auth === "oauth") {
      setOauthTarget(item)
      return
    }
    await saveApp({
      name: item.name,
      url: item.url,
      auth: item.auth,
      category: item.category,
      maintainer: item.maintainer,
    })
  }

  async function connectApiKey() {
    if (!apiKeyTarget) return
    const field = apiKeyTarget.fields?.[0]
    const secret = (apiKeyValues[field?.label ?? "API Key"] ?? "").trim()
    if (!secret) {
      toast.error("Paste a key first")
      return
    }
    const ok = await saveApp({
      name: apiKeyTarget.name,
      url: apiKeyTarget.url,
      auth: "apikey",
      secret,
      headerName: field?.headerName,
      category: apiKeyTarget.category,
      maintainer: apiKeyTarget.maintainer,
    })
    if (ok) {
      setApiKeyTarget(null)
      setApiKeyValues({})
    }
  }

  async function addCustom() {
    const name = customForm.name.trim()
    const url = customForm.url.trim()
    if (!name || !url) {
      toast.error("Name and server URL are required")
      return
    }
    const auth: McpAuth = customForm.auth === "open" ? "open" : "apikey"
    if (auth === "apikey" && !customForm.secret.trim()) {
      toast.error("Paste a key first")
      return
    }
    const ok = await saveApp({
      name,
      url,
      auth,
      secret: auth === "apikey" ? customForm.secret.trim() : undefined,
      headerName:
        customForm.auth === "header" ? customForm.headerName.trim() : undefined,
      custom: true,
    })
    if (ok) {
      setShowCustom(false)
      setCustomForm({
        name: "",
        url: "",
        auth: "open",
        secret: "",
        headerName: "Authorization",
      })
    }
  }

  async function disconnect(server: ConnectedServer) {
    setAddingUrl(server.url)
    await fetch(`/api/apps?id=${server.id}`, { method: "DELETE" })
    setAddingUrl(null)
    toast.success(`${server.name} removed`)
    await load()
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        !embedded && "flex-1"
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col",
          !embedded && "mx-auto max-w-5xl p-4 md:p-6"
        )}
      >
      <div className="mb-6 space-y-4">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === "browse" || value === "mine") setTab(value)
          }}
        >
          <TabsList>
            <TabsTrigger value="browse" className="px-3">
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="mine" className="px-3">
              My Apps
              {servers.length > 0 ? ` (${servers.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "browse" ? (
          <div className="relative w-full sm:w-auto sm:flex-none">
            <SearchIcon className="text-muted-foreground/40 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search apps..."
              className="h-8 w-full pl-8 text-sm sm:w-52"
            />
          </div>
        ) : null}
      </div>
      {tab === "browse" ? (
        <CategoryPills value={category} onChange={setCategory} />
      ) : null}
      </div>

      {tab === "browse" ? (
        <div className="space-y-8">
          {!query && category === "all" ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Featured</h2>
                <CountPill value={featured.length} />
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {featured.map((item) => (
                  <CatalogCard
                    key={item.url}
                    item={item}
                    state={cardState(item.url)}
                    isAdding={addingUrl === normalizeMcpUrl(item.url)}
                    onAdd={addCatalogItem}
                    onConnect={connectCatalogItem}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                {query || category !== "all" ? "Results" : "All Servers"}
              </h2>
              <CountPill value={filtered.length} />
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <CardSkeleton key={index} />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className="bg-card/30 hover:border-primary/40 hover:bg-card/50 group flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border/60 shadow-none transition-all duration-200"
                >
                  <div className="text-muted-foreground group-hover:text-primary flex flex-col items-center gap-2 transition-colors">
                    <div className="bg-muted/50 group-hover:bg-primary/10 flex size-8 items-center justify-center rounded-xl transition-colors">
                      <PlusIcon className="size-4" />
                    </div>
                    <span className="text-muted-foreground mt-2 text-xs font-medium">
                      Add custom server
                    </span>
                  </div>
                </button>
                {filtered.map((item) => (
                  <CatalogCard
                    key={item.url}
                    item={item}
                    state={cardState(item.url)}
                    isAdding={addingUrl === normalizeMcpUrl(item.url)}
                    onAdd={addCatalogItem}
                    onConnect={connectCatalogItem}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <p className="text-muted-foreground text-center text-sm">
                  No servers match “{query}”
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    setCategory("all")
                  }}
                  className="text-primary mt-2 text-xs font-medium transition-colors hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">My Apps</h2>
              {servers.length > 0 ? <CountPill value={servers.length} /> : null}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setShowCustom(true)}
            >
              <PlusIcon className="size-3" />
              Add App
            </Button>
          </div>
          {loading ? (
            <div className="bg-card/50 divide-border/40 divide-y overflow-hidden rounded-xl border border-border/60">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-3.5">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-44" />
                  </div>
                  <Skeleton className="size-8 shrink-0 rounded-md" />
                </div>
              ))}
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-12">
              <div className="bg-muted/50 flex size-10 items-center justify-center rounded-xl">
                <BlocksIcon className="text-muted-foreground/50 size-[18px]" />
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-sm font-medium">
                  No apps connected
                </p>
                <p className="text-muted-foreground/60 mt-1.5 text-sm">
                  Browse to add your first app
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-1"
                onClick={() => setTab("browse")}
              >
                Browse Apps
              </Button>
            </div>
          ) : (
            <div className="bg-card/50 divide-border/40 divide-y overflow-hidden rounded-xl border border-border/60">
              {servers.map((server) => {
                const catalog = catalogItemForUrl(server.url)
                let host = server.url
                try {
                  host = new URL(server.url).hostname
                } catch {
                  host = server.url
                }
                return (
                  <div
                    key={server.id}
                    className="hover:bg-muted/20 flex items-center gap-4 px-5 py-4 transition-colors"
                  >
                    <ServiceIcon
                      url={catalog?.maintainerUrl || server.url}
                      name={server.name}
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-medium">{server.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {server.auth === "oauth" && server.status !== "ready"
                          ? "Saved · OAuth sign-in not connected"
                          : host}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {server.auth === "oauth" && server.status !== "ready" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          disabled={addingUrl === server.url}
                          onClick={() => void startOauth(server)}
                        >
                          {addingUrl === server.url ? "Connecting" : "Connect"}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={addingUrl === server.url}
                        onClick={() => void disconnect(server)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <Dialog
        open={oauthTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOauthTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save {oauthTarget?.name}?</DialogTitle>
            <DialogDescription>
              {oauthTarget?.name} uses OAuth. Add only saves it to My Apps. It
              does not sign you in, and jobs will not call this MCP yet. Search
              and prices still come from Settings → Connectors.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOauthTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={Boolean(addingUrl)}
              onClick={() => {
                if (!oauthTarget) return
                void saveApp({
                  name: oauthTarget.name,
                  url: oauthTarget.url,
                  auth: "oauth",
                  category: oauthTarget.category,
                  maintainer: oauthTarget.maintainer,
                }).then((ok) => {
                  if (ok) setOauthTarget(null)
                })
              }}
            >
              {addingUrl ? "Saving..." : "Save to My Apps"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={apiKeyTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApiKeyTarget(null)
            setApiKeyValues({})
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {apiKeyTarget?.name}</DialogTitle>
            <DialogDescription>
              {apiKeyTarget?.fields?.[0]?.hintText ??
                "Paste an API key. It is stored encrypted."}
            </DialogDescription>
          </DialogHeader>
          {(apiKeyTarget?.fields ?? [{ label: "API Key", placeholder: "Paste key", headerName: "Authorization" }]).map(
            (field) => (
              <div key={field.label} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`app-key-${field.label}`}>{field.label}</Label>
                  {field.hintUrl ? (
                    <a
                      href={field.hintUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs underline-offset-4 hover:underline"
                    >
                      Get key
                    </a>
                  ) : null}
                </div>
                <Input
                  id={`app-key-${field.label}`}
                  type="password"
                  autoComplete="off"
                  value={apiKeyValues[field.label] ?? ""}
                  onChange={(event) =>
                    setApiKeyValues((current) => ({
                      ...current,
                      [field.label]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                />
                {field.steps?.length ? (
                  <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
                    {field.steps.map((step) => (
                      <li key={step.text}>
                        {step.text}
                        {step.url ? (
                          <>
                            {" "}
                            <a
                              href={step.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {step.urlLabel ?? "Open"}
                            </a>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            )
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApiKeyTarget(null)
                setApiKeyValues({})
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={addingUrl === normalizeMcpUrl(apiKeyTarget?.url ?? "")}
              onClick={() => void connectApiKey()}
            >
              {addingUrl ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCustom}
        onOpenChange={(open) => {
          setShowCustom(open)
          if (!open) {
            setCustomForm({
              name: "",
              url: "",
              auth: "open",
              secret: "",
              headerName: "Authorization",
            })
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add custom app</DialogTitle>
            <DialogDescription>
              Stored securely · editable later in My Apps
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="custom-name">Name</Label>
              <Input
                id="custom-name"
                value={customForm.name}
                onChange={(event) =>
                  setCustomForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="My MCP server"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-url">Server URL</Label>
              <Input
                id="custom-url"
                value={customForm.url}
                onChange={(event) =>
                  setCustomForm((current) => ({
                    ...current,
                    url: event.target.value,
                  }))
                }
                placeholder="https://mcp.example.com/mcp"
              />
            </div>
            <div className="space-y-2">
              <Label>Auth</Label>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["open", "None"],
                    ["apikey", "Bearer token"],
                    ["header", "Custom header"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setCustomForm((current) => ({ ...current, auth: value }))
                    }
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      customForm.auth === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {customForm.auth === "header" ? (
              <div className="space-y-2">
                <Label htmlFor="custom-header">Header name</Label>
                <Input
                  id="custom-header"
                  value={customForm.headerName}
                  onChange={(event) =>
                    setCustomForm((current) => ({
                      ...current,
                      headerName: event.target.value,
                    }))
                  }
                  placeholder="Authorization"
                />
              </div>
            ) : null}
            {customForm.auth !== "open" ? (
              <div className="space-y-2">
                <Label htmlFor="custom-secret">
                  {customForm.auth === "header" ? "Header value" : "Bearer token"}
                </Label>
                <Input
                  id="custom-secret"
                  type="password"
                  autoComplete="off"
                  value={customForm.secret}
                  onChange={(event) =>
                    setCustomForm((current) => ({
                      ...current,
                      secret: event.target.value,
                    }))
                  }
                  placeholder="Paste secret"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustom(false)}>
              Cancel
            </Button>
            <Button disabled={Boolean(addingUrl)} onClick={() => void addCustom()}>
              {addingUrl ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

export function AppsMarketplace({
  embedded = false,
  tabParam = "tab",
}: {
  embedded?: boolean
  tabParam?: "tab" | "view"
}) {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            "flex w-full flex-col gap-6",
            !embedded && "mx-auto max-w-5xl p-4 md:p-6"
          )}
        >
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      }
    >
      <AppsContent embedded={embedded} tabParam={tabParam} />
    </Suspense>
  )
}
