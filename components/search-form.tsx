"use client"

import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar"
import { SearchIcon } from "lucide-react"

export function SearchForm({
  onQueryChange,
  ...props
}: React.ComponentProps<"form"> & {
  onQueryChange?: (query: string) => void
}) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault()
        props.onSubmit?.(event)
      }}
    >
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="sidebar-search" className="sr-only">
            Search
          </Label>
          <SidebarInput
            id="sidebar-search"
            placeholder="Search..."
            className="pl-8"
            onChange={(event) => onQueryChange?.(event.target.value)}
          />
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}
