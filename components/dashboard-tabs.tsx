import Link from "next/link"

import { ArrowLeftIcon } from "lucide-react"

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
