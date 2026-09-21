"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type EndpointRow = {
  id: string
  url: string
}

export type ApiProvider = {
  id: string
  name: string
  apiKey: string
  endpoints: string[]
}

function emptyEndpoint(): EndpointRow {
  return { id: crypto.randomUUID(), url: "" }
}

function emptyDraft() {
  return {
    name: "",
    apiKey: "",
    endpoints: [emptyEndpoint()],
    validated: false,
  }
}

function last4(key: string) {
  return key.slice(-4)
}

export function ApiProvidersEditor({
  providers,
  onChange,
}: {
  providers: ApiProvider[]
  onChange: (providers: ApiProvider[]) => void
}) {
  const [draft, setDraft] = useState(emptyDraft)
  const [open, setOpen] = useState(providers.length === 0)
  const [validating, setValidating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const firstEndpoint = draft.endpoints[0]?.url.trim() ?? ""

  function resetDraft() {
    setDraft(emptyDraft())
    setMessage(null)
    setValidating(false)
  }

  async function validateKey() {
    if (!draft.apiKey.trim() || !firstEndpoint) {
      setMessage("Add the API key and first endpoint first.")
      return
    }

    setValidating(true)
    setMessage(null)

    try {
      const response = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: draft.apiKey.trim(),
          endpoint: firstEndpoint,
        }),
      })
      const result = (await response.json()) as {
        ok?: boolean
        error?: string
      }

      if (result.ok) {
        setDraft((current) => ({ ...current, validated: true }))
        setMessage("Key is valid on that endpoint.")
      } else {
        setDraft((current) => ({ ...current, validated: false }))
        setMessage(result.error ?? "Could not validate that key.")
      }
    } catch {
      setDraft((current) => ({ ...current, validated: false }))
      setMessage("Could not reach the validator.")
    } finally {
      setValidating(false)
    }
  }

  function saveProvider() {
    const name = draft.name.trim()
    const apiKey = draft.apiKey.trim()
    const endpoints = draft.endpoints
      .map((row) => row.url.trim())
      .filter(Boolean)

    if (!name || !apiKey || endpoints.length === 0 || !draft.validated) {
      setMessage("Validate the first endpoint before saving this provider.")
      return
    }

    onChange([
      ...providers,
      {
        id: crypto.randomUUID(),
        name,
        apiKey,
        endpoints,
      },
    ])
    resetDraft()
    setOpen(false)
  }

  return (
    <div className="grid gap-3">
      {providers.length > 0 ? (
        <ul className="grid gap-2">
          {providers.map((provider) => (
            <li
              key={provider.id}
              className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{provider.name}</p>
                <p className="text-muted-foreground text-xs">
                  ••••{last4(provider.apiKey)} · {provider.endpoints.length}{" "}
                  endpoint{provider.endpoints.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${provider.name}`}
                onClick={() => {
                  const next = providers.filter((row) => row.id !== provider.id)
                  onChange(next)
                  if (next.length === 0) {
                    setOpen(true)
                  }
                }}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="grid gap-3 rounded-lg border p-3">
          <Field className="gap-1">
            <FieldLabel htmlFor="provider-name">API provider</FieldLabel>
            <Input
              id="provider-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Serper"
            />
          </Field>

          <Field className="gap-1">
            <FieldLabel htmlFor="provider-key">API key</FieldLabel>
            <Input
              id="provider-key"
              type="password"
              autoComplete="off"
              value={draft.apiKey}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  apiKey: event.target.value,
                  validated: false,
                }))
                setMessage(null)
              }}
              placeholder="sk-..."
            />
          </Field>

          <Field className="gap-1">
            <FieldLabel htmlFor="provider-endpoint-0">Endpoint</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="provider-endpoint-0"
                value={draft.endpoints[0]?.url ?? ""}
                onChange={(event) => {
                  const url = event.target.value
                  setDraft((current) => ({
                    ...current,
                    validated: false,
                    endpoints: current.endpoints.map((row, index) =>
                      index === 0 ? { ...row, url } : row
                    ),
                  }))
                  setMessage(null)
                }}
                placeholder="https://api.example.com/v1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={validating}
                onClick={() => void validateKey()}
              >
                {validating ? "Checking" : "Validate key"}
              </Button>
            </div>
            {message ? (
              <p
                className={
                  draft.validated
                    ? "text-xs text-foreground"
                    : "text-xs text-destructive"
                }
              >
                {message}
              </p>
            ) : null}
            {draft.validated ? (
              <Badge variant="secondary">Validated</Badge>
            ) : null}
          </Field>

          {draft.validated ? (
            <>
              {draft.endpoints.slice(1).map((endpoint, index) => (
                <div key={endpoint.id} className="flex gap-2">
                  <Input
                    value={endpoint.url}
                    onChange={(event) => {
                      const url = event.target.value
                      setDraft((current) => ({
                        ...current,
                        endpoints: current.endpoints.map((row) =>
                          row.id === endpoint.id ? { ...row, url } : row
                        ),
                      }))
                    }}
                    placeholder="https://api.example.com/v1"
                    aria-label={`Endpoint ${index + 2}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove endpoint ${index + 2}`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        endpoints: current.endpoints.filter(
                          (row) => row.id !== endpoint.id
                        ),
                      }))
                    }
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit px-0 text-muted-foreground hover:bg-transparent"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    endpoints: [...current.endpoints, emptyEndpoint()],
                  }))
                }
              >
                <PlusIcon />
                Add endpoint
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={saveProvider}>
                  Save provider
                </Button>
                {providers.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetDraft()
                      setOpen(false)
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => {
            resetDraft()
            setOpen(true)
          }}
        >
          <PlusIcon />
          Add provider
        </Button>
      )}
    </div>
  )
}
