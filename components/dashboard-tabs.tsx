import Link from "next/link"

import { cn } from "cn"
import { ArrowLeftIcon } from "lucide-react"

const DASHBOARD_TABS = [
  { id: "agents", label: "Agents", yours: "Your Agents" },
  { id: "workers", label: "Workers", yours: "Your Workers" },
  { id: "tasks", label: "Task", yours: "Your Tasks" },
] as const

const MARKETPLACE_TABS = [
  { id: "agents", label: "Agents" },
  { id: "workers", label: "Workers" },
  { id: "tasks", label: "Task" },
  { id: "brands", label: "Brands" },
] as const

export function DashboardTabs({
  active,
  basePath = "/dashboard",
}: {
  active: string
  basePath?: string
}) {
  const marketplace = basePath === "/marketplace"
  const tabs = marketplace ? MARKETPLACE_TABS : DASHBOARD_TABS
  return (
    <nav className="bg-muted inline-flex h-8 w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <Link
            key={tab.id}
            href={`${basePath}?tab=${tab.id}`}
            className={cn(
              "inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md px-3 py-0.5 text-sm font-medium whitespace-nowrap transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                : "text-foreground/60 hover:text-foreground"
            )}
          >
            {marketplace ? tab.label : "yours" in tab ? tab.yours : tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardBackLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
    >
      <ArrowLeftIcon className="size-3.5" />
      {label}
    </Link>
  )
}
