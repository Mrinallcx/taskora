"use client"

import { Suspense, useEffect, useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  LogOutIcon,
  PlugIcon,
  SettingsIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react"

import { SettingsConnectors } from "@/components/settings-connectors"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useBlurPersonalInfo } from "@/hooks/use-blur-personal-info"
import { cn } from "@/lib/utils"

type SettingsTab = "account" | "wallet" | "connectors" | "preferences"

const TABS: {
  value: SettingsTab
  label: string
  description: string
  icon: typeof UserRoundIcon
}[] = [
  {
    value: "account",
    label: "Account",
    description: "Your profile and sign-in details",
    icon: UserRoundIcon,
  },
  {
    value: "wallet",
    label: "Wallet",
    description: "Play money available and held in escrow",
    icon: WalletIcon,
  },
  {
    value: "connectors",
    label: "Connectors",
    description: "Connect search and price sources for your jobs",
    icon: PlugIcon,
  },
  {
    value: "preferences",
    label: "Preferences",
    description: "How your name is shown",
    icon: SettingsIcon,
  },
]

function tabMeta(value: string) {
  const index = TABS.findIndex((tab) => tab.value === value)
  const tab = TABS[index] ?? TABS[0]
  return {
    ...tab,
    number: String((index < 0 ? 0 : index) + 1).padStart(2, "0"),
  }
}

function isSettingsTab(value: string | null): value is SettingsTab {
  return TABS.some((tab) => tab.value === value)
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function SettingsContent() {
  const { user, isLoaded } = useUser()
  const { signOut, openUserProfile } = useClerk()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [blurPersonalInfo, setBlurPersonalInfo] = useBlurPersonalInfo()
  const [wallet, setWallet] = useState<{
    availableCents: number
    escrowedCents: number
  } | null>(null)
  const [crediting, setCrediting] = useState(false)

  const requested = searchParams.get("tab")
  const activeTab: SettingsTab =
    requested === "keys"
      ? "connectors"
      : isSettingsTab(requested)
        ? requested
        : "account"

  useEffect(() => {
    if (requested !== "apps") return
    const view = searchParams.get("view")
    router.replace(view === "mine" ? "/apps?tab=mine" : "/apps")
  }, [requested, router, searchParams])
  const current = tabMeta(activeTab)
  const name = user?.fullName ?? user?.username ?? "User"
  const email = user?.primaryEmailAddress?.emailAddress ?? ""

  useEffect(() => {
    void fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!json) return
        setWallet({
          availableCents: json.availableCents ?? 0,
          escrowedCents: json.escrowedCents ?? 0,
        })
      })
  }, [])

  function setActiveTab(value: string | null) {
    if (!isSettingsTab(value)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  async function handleSignOut() {
    toast.loading("Signing out...")
    try {
      await signOut({ redirectUrl: "/sign-in" })
    } catch {
      toast.error("Failed to sign out")
    }
  }

  async function addPlayMoney() {
    setCrediting(true)
    const response = await fetch("/api/wallet/dev-credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cents: 100000 }),
    })
    setCrediting(false)
    if (!response.ok) {
      toast.error("Could not add play money")
      return
    }
    const json = await response.json()
    setWallet({
      availableCents: json.availableCents,
      escrowedCents: json.escrowedCents,
    })
    toast.success("Added $1,000.00")
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-heading text-3xl">Settings</h1>
        <div className="text-right">
          <p className="font-mono text-xs text-muted-foreground/50">
            {current.number}
          </p>
          <p className="text-sm font-medium">{current.label}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <current.icon className="size-4" />
                  {current.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TABS.map((tab) => {
                const meta = tabMeta(tab.value)
                const Icon = tab.icon
                return (
                  <SelectItem key={tab.value} value={tab.value}>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground/40 w-4 font-mono text-[9px]">
                        {meta.number}
                      </span>
                      <Icon className="size-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <aside className="hidden w-64 shrink-0 space-y-4 lg:block">
          <Card className="border border-border/60 p-6 shadow-none ring-0">
            <div className="flex flex-col items-center space-y-4 text-center">
              {!isLoaded ? (
                <Skeleton className="size-20 rounded-full" />
              ) : (
                <UserAvatar
                  user={user}
                  name={name}
                  className={cn(
                    "size-20 ring-2 ring-border/50 ring-offset-2 ring-offset-background",
                    blurPersonalInfo && "blur-sm"
                  )}
                  fallbackClassName="text-lg"
                />
              )}
              <div className="min-w-0 space-y-1">
                <h3
                  className={cn(
                    "truncate text-base font-semibold",
                    blurPersonalInfo && "blur-sm"
                  )}
                >
                  {name}
                </h3>
                <p
                  className={cn(
                    "text-muted-foreground truncate text-xs",
                    blurPersonalInfo && "blur-sm"
                  )}
                >
                  {email}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Label
                htmlFor="blur-personal"
                className="text-muted-foreground text-xs font-normal"
              >
                Blur personal info
              </Label>
              <Switch
                id="blur-personal"
                size="sm"
                checked={blurPersonalInfo}
                onCheckedChange={setBlurPersonalInfo}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-foreground mt-3 w-full gap-2"
              onClick={() => void handleSignOut()}
            >
              <LogOutIcon />
              Sign Out
            </Button>
          </Card>

          <div className="flex flex-col gap-1">
            {TABS.map((tab) => {
              const meta = tabMeta(tab.value)
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    activeTab === tab.value
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span className="text-muted-foreground/40 w-4 font-mono text-[9px]">
                    {meta.number}
                  </span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <p className="font-mono text-xs text-muted-foreground/50">
              {current.number}
            </p>
            <h2 className="font-heading mt-1 text-2xl">{current.label}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {current.description}
            </p>
          </div>

          {activeTab === "account" ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4 pb-3">
                <UserAvatar
                  user={user}
                  name={name}
                  className={cn(
                    "size-20 ring-2 ring-border/50 ring-offset-2 ring-offset-background",
                    blurPersonalInfo && "blur-sm"
                  )}
                  fallbackClassName="text-lg"
                />
                <div className="min-w-0 space-y-1">
                  <h3
                    className={cn(
                      "truncate text-lg font-semibold",
                      blurPersonalInfo && "blur-sm"
                    )}
                  >
                    {name}
                  </h3>
                  <p
                    className={cn(
                      "text-muted-foreground break-all text-sm",
                      blurPersonalInfo && "blur-sm"
                    )}
                  >
                    {email}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-muted-foreground/50 font-mono text-xs">
                    01
                  </span>
                  <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Account Details
                  </h4>
                </div>
                <div className="divide-border/40 divide-y rounded-lg border border-border/60">
                  <div className="p-4">
                    <Label className="text-muted-foreground/50 text-xs tracking-[0.12em] uppercase">
                      Full Name
                    </Label>
                    <p
                      className={cn(
                        "mt-1 text-sm font-medium",
                        blurPersonalInfo && "blur-sm"
                      )}
                    >
                      {name}
                    </p>
                  </div>
                  <div className="p-4">
                    <Label className="text-muted-foreground/50 text-xs tracking-[0.12em] uppercase">
                      Email Address
                    </Label>
                    <p
                      className={cn(
                        "mt-1 text-sm font-medium break-all",
                        blurPersonalInfo && "blur-sm"
                      )}
                    >
                      {email || "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                  <p className="text-muted-foreground text-xs">
                    Name and email come from your sign-in account. Update them
                    there if you need to change them.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openUserProfile()}
                >
                  Manage account
                </Button>
              </div>
            </div>
          ) : null}

          {activeTab === "wallet" ? (
            <div className="space-y-3">
              <div className="divide-border/40 divide-y rounded-lg border border-border/60">
                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium">Available</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Play money you can put on a job
                    </p>
                  </div>
                  <p className="font-mono text-sm">
                    {wallet ? dollars(wallet.availableCents) : "—"}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium">In escrow</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Locked on jobs that have not settled
                    </p>
                  </div>
                  <p className="font-mono text-sm">
                    {wallet ? dollars(wallet.escrowedCents) : "—"}
                  </p>
                </div>
              </div>
              {process.env.NODE_ENV !== "production" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={crediting}
                  onClick={() => void addPlayMoney()}
                >
                  {crediting ? "Adding..." : "Add $1,000 play money"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {activeTab === "connectors" ? <SettingsConnectors /> : null}

          {activeTab === "preferences" ? (
            <div className="divide-border/40 divide-y rounded-lg border border-border/60 px-4">
              <div className="flex items-center justify-between gap-6 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Blur personal info</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Hide your name, email, and photo on this page
                  </p>
                </div>
                <Switch
                  checked={blurPersonalInfo}
                  onCheckedChange={setBlurPersonalInfo}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
          <Skeleton className="h-9 w-40" />
          <div className="flex gap-6">
            <Skeleton className="hidden h-80 w-64 lg:block" />
            <Skeleton className="h-64 flex-1" />
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  )
}
