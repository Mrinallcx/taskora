"use client"

import { useEffect, useRef, useState } from "react"

import { MAX_LAUNCH_STOCKS, type StockListing } from "@/src/domain/stock-types"

function errorMessage(payload: { error?: string | { message?: string } }) {
  if (typeof payload.error === "string") return payload.error
  return payload.error?.message
}

export function StockPicker({
  value,
  onChange,
  disabled,
  searchPath = "/api/stocks/search",
  placeholder = "Search NASDAQ…",
  fullPlaceholder = "Max 4 stocks",
  errorCopy = "Could not search stocks.",
  inputId = "job-stock",
}: {
  value: StockListing[]
  onChange: (stocks: StockListing[]) => void
  disabled?: boolean
  searchPath?: string
  placeholder?: string
  fullPlaceholder?: string
  errorCopy?: string
  inputId?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<StockListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const selected = new Set(value.map((row) => row.symbol))
  const full = value.length >= MAX_LAUNCH_STOCKS

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 2) {
      setResults([])
      setError("")
      return
    }
    let ignore = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `${searchPath}?q=${encodeURIComponent(needle)}`
        )
        const json = (await response.json()) as {
          results?: StockListing[]
          error?: string | { message?: string }
        }
        if (ignore) return
        if (!response.ok) {
          setResults([])
          setError(errorMessage(json) ?? errorCopy)
          return
        }
        setError("")
        setResults(json.results ?? [])
      } catch {
        if (!ignore) {
          setResults([])
          setError(errorCopy)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }, 400)
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [query, searchPath, errorCopy])

  function add(row: StockListing) {
    if (selected.has(row.symbol) || full) return
    onChange([...value, row])
    setQuery("")
    setResults([])
    inputRef.current?.focus()
  }

  function remove(symbol: string) {
    onChange(value.filter((item) => item.symbol !== symbol))
    inputRef.current?.focus()
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div
        className="flex min-h-8 flex-wrap items-center gap-1 px-2 py-1"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((row) => (
          <span
            key={row.symbol}
            className="bg-muted text-foreground inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium"
          >
            {row.symbol}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground leading-none"
              disabled={disabled}
              aria-label={`Remove ${row.symbol}`}
              onClick={(event) => {
                event.stopPropagation()
                remove(row.symbol)
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          value={query}
          disabled={disabled || full}
          autoComplete="off"
          placeholder={full ? fullPlaceholder : placeholder}
          className="placeholder:text-muted-foreground min-w-20 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !query && value.length > 0) {
              remove(value[value.length - 1].symbol)
            }
          }}
        />
      </div>
      {query.trim() ? (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border shadow-md">
          {loading ? (
            <p className="text-muted-foreground px-2.5 py-2 text-sm">
              Searching…
            </p>
          ) : error ? (
            <p className="text-destructive px-2.5 py-2 text-sm">{error}</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground px-2.5 py-2 text-sm">
              No match.
            </p>
          ) : (
            <ul>
              {results.map((row) => {
                const taken = selected.has(row.symbol)
                return (
                  <li key={row.symbol}>
                    <button
                      type="button"
                      disabled={taken || full}
                      className="hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm disabled:opacity-50"
                      onClick={() => add(row)}
                    >
                      <span className="truncate">{row.name}</span>
                      <span className="text-muted-foreground ml-3 shrink-0 text-xs">
                        {row.symbol}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
