"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Building2Icon,
  LayoutGridIcon,
  MinusIcon,
  PlusIcon,
  RocketIcon,
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { SearchForm } from "@/components/search-form"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutGridIcon,
      items: [],
    },
    {
      title: "Launch Agent",
      url: "/launch-agent",
      icon: RocketIcon,
      items: [{ title: "New agent", url: "/launch-agent" }],
    },
    {
      title: "Merchant",
      url: "/merchant",
      icon: Building2Icon,
      items: [{ title: "Register", url: "/merchant" }],
    },
  ],
}

function isItemActive(url: string, pathname: string, search: string) {
  const [path, query = ""] = url.split("?")
  if (pathname !== path) {
    if (path === "/dashboard" && pathname.startsWith("/dashboard/")) {
      return true
    }
    return false
  }

  const wanted = new URLSearchParams(query)
  const current = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  )

  if (path === "/dashboard") {
    return true
  }
  if (path === "/launch-agent") {
    return true
  }
  if (wanted.size === 0) return true
  for (const [key, value] of wanted) {
    if (current.get(key) !== value) return false
  }
  return true
}

function NavGroup({
  item,
  pathname,
  search,
  defaultOpen,
}: {
  item: {
    title: string
    url: string
    icon: LucideIcon
    items: { title: string; url: string }[]
  }
  pathname: string
  search: string
  defaultOpen: boolean
}) {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const Icon = item.icon
  const itemPath = item.url.split("?")[0]
  const wanted = new URLSearchParams(item.url.split("?")[1] ?? "")
  const current = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  )
  const sectionActive =
    (pathname === itemPath ||
      (itemPath !== "/" && pathname.startsWith(`${itemPath}/`))) &&
    (itemPath !== "/settings" ||
      (current.get("tab") ?? "account") ===
        (wanted.get("tab") ?? "account"))

  if (item.items.length === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={sectionActive}
          render={<Link href={item.url} />}
        >
          <Icon />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                tooltip={item.title}
                isActive={sectionActive}
              />
            }
          >
            <Icon />
            <span>{item.title}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={4}
            className="min-w-48"
          >
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            {item.items.map((subItem) => (
              <DropdownMenuItem
                key={subItem.title}
                render={<Link href={subItem.url} />}
              >
                {subItem.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={sectionActive}
          render={<CollapsibleTrigger />}
        >
          <Icon />
          <span>{item.title}</span>
          <PlusIcon className="ml-auto group-data-open/collapsible:hidden" />
          <MinusIcon className="ml-auto hidden group-data-open/collapsible:block" />
        </SidebarMenuButton>
        {item.items.length ? (
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    isActive={isItemActive(subItem.url, pathname, search)}
                    render={<Link href={subItem.url} />}
                  >
                    {subItem.title}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        ) : null}
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const [query, setQuery] = React.useState("")
  const needle = query.trim().toLowerCase()

  const navMain = data.navMain
    .map((group) => {
      if (!needle) return group
      const groupHit = group.title.toLowerCase().includes(needle)
      const items = group.items.filter((item) =>
        item.title.toLowerCase().includes(needle)
      )
      if (groupHit) return group
      if (items.length === 0) return null
      return { ...group, items }
    })
    .filter((group): group is (typeof data.navMain)[number] => group !== null)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                className="size-8 object-contain"
              />
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="font-heading truncate text-lg tracking-tight">
                  Taskora
                </span>
                <span className="text-muted-foreground truncate text-xs font-medium">
                  by <span className="text-primary font-semibold">LCX</span>
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SearchForm
          className="group-data-[collapsible=icon]:hidden"
          onQueryChange={setQuery}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navMain.map((item) => (
              <NavGroup
                key={item.title}
                item={item}
                pathname={pathname}
                search={search}
                defaultOpen={
                  Boolean(needle) ||
                  pathname === item.url.split("?")[0] ||
                  pathname.startsWith(`${item.url.split("?")[0]}/`)
                }
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
