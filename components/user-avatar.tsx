import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function userInitials(name?: string | null) {
  if (!name) return "U"
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function UserAvatar({
  user,
  name,
  className,
  fallbackClassName,
}: {
  user?: { hasImage: boolean; imageUrl: string } | null
  name?: string | null
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={className}>
      {user?.hasImage ? (
        <AvatarImage src={user.imageUrl} alt={name ?? ""} />
      ) : null}
      <AvatarFallback
        className={cn("bg-primary text-primary-foreground", fallbackClassName)}
      >
        {userInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
