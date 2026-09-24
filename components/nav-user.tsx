"use client"

import { useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import Link from "next/link"
import { toast } from "sonner"
import {
  ChevronsUpDownIcon,
  EyeIcon,
  EyeOffIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function maskEmail(email: string) {
  const [username, domain] = email.split("@")
  if (!domain) return `${email.slice(0, 3)}•••`
  return `${username.slice(0, 3)}•••@${domain}`
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { isLoaded, isSignedIn, user } = useUser()
  const authOff = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1"
  const { signOut } = useClerk()
  const [showEmail, setShowEmail] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const name = user?.fullName ?? user?.username ?? "Account"
  const email = user?.primaryEmailAddress?.emailAddress ?? ""

  async function handleSignOut() {
    setSigningOut(true)
    toast.loading("Signing out...")
    try {
      await signOut({ redirectUrl: "/sign-in" })
    } catch {
      setSigningOut(false)
      toast.error("Failed to sign out")
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {!isLoaded ? (
          <SidebarMenuButton size="lg" disabled>
            <UserAvatar name="Account" className="size-8" />
            <span className="group-data-[collapsible=icon]:hidden">
              Account
            </span>
          </SidebarMenuButton>
        ) : authOff ? (
          <SidebarMenuButton size="lg" tooltip="Guest">
            <UserAvatar name="Guest" className="size-8" />
            <span className="group-data-[collapsible=icon]:hidden">Guest</span>
          </SidebarMenuButton>
        ) : isSignedIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  tooltip="Account"
                  className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                />
              }
            >
              <UserAvatar user={user} name={name} className="size-8" />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {email}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-64 rounded-xl p-1.5"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={8}
            >
              <div className="px-2 py-1.5">
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Account
                </p>
                <div className="flex items-center gap-2.5">
                  <UserAvatar user={user} name={name} className="size-9" />
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground truncate text-xs">
                        {showEmail ? email : maskEmail(email)}
                      </span>
                      {email ? (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5"
                          aria-label={showEmail ? "Hide email" : "Show email"}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setShowEmail((open) => !open)
                          }}
                        >
                          {showEmail ? (
                            <EyeOffIcon className="size-3.5" />
                          ) : (
                            <EyeIcon className="size-3.5" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={signingOut}
                onClick={() => void handleSignOut()}
              >
                <LogOutIcon />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SidebarMenuButton render={<Link href="/sign-in" />}>
            Sign in
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
