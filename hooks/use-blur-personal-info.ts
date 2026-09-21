"use client"

import { useEffect, useState } from "react"

const KEY = "taskora-blur-personal-info"

export function useBlurPersonalInfo() {
  const [blur, setBlur] = useState(false)

  useEffect(() => {
    setBlur(window.localStorage.getItem(KEY) === "1")
  }, [])

  function setBlurPersonalInfo(next: boolean) {
    setBlur(next)
    window.localStorage.setItem(KEY, next ? "1" : "0")
  }

  return [blur, setBlurPersonalInfo] as const
}
