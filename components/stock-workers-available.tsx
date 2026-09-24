"use client"

import { useEffect, useState } from "react"

import { ResearchOrb } from "@/components/research-orb"
import { stockWorkersAvailableCopy } from "@/src/domain/stock-workers"

export function StockWorkersAvailable() {
  const [available, setAvailable] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const response = await fetch("/api/stocks/workers")
      if (!response.ok || cancelled) return
      const payload = (await response.json()) as { available?: number }
      if (!cancelled) setAvailable(payload.available ?? 0)
    }
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex items-center gap-2 pt-1">
      <ResearchOrb />
      <span className="text-sm font-medium">
        {available == null
          ? "Checking workers"
          : stockWorkersAvailableCopy(available)}
      </span>
    </div>
  )
}
