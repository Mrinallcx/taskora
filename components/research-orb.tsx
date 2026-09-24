"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { ThinkingOrb } from "thinking-orbs"

import {
  RESEARCH_ORB_PHASES,
  researchOrbPhase,
} from "@/src/domain/research-orb"

export function ResearchOrb({
  startedAt,
}: {
  startedAt?: Date | string
}) {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const started = startedAt ? +new Date(startedAt) : Date.now()
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState(() => researchOrbPhase(started, Date.now()))

  useEffect(() => {
    setReady(true)
    const tick = () => setPhase(researchOrbPhase(started, Date.now()))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [started])

  const current = RESEARCH_ORB_PHASES[phase] ?? RESEARCH_ORB_PHASES[0]

  if (!ready) return <span className="size-5 shrink-0" />

  return (
    <ThinkingOrb
      state={current.state}
      size={20}
      speed={1.2}
      theme={dark ? "dark" : "light"}
      color="#2B6BFF"
      dots={1.8}
      dotSize={1.35}
      paused={false}
      aria-label={current.label}
    />
  )
}
