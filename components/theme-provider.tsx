"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      scriptProps={{
        // Client-rendered <script> tags are inert in React 19; keep them
        // executable only in the SSR HTML. See Next.js "Preventing Flash".
        type: typeof window === "undefined" ? "text/javascript" : "text/plain",
      }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
