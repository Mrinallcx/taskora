"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type Merchant = {
  slug: string
  name: string
  tagline: string
  about: string
  website: string
  logo: string
  status: "draft" | "live"
  isPublic: boolean
}

function errorMessage(payload: { error?: string | { message?: string } }) {
  if (typeof payload.error === "string") return payload.error
  return payload.error?.message
}

export function MerchantRegisterForm() {
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(false)
  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [about, setAbout] = useState("")
  const [website, setWebsite] = useState("")
  const [logo, setLogo] = useState("")
  const [live, setLive] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [slug, setSlug] = useState("")

  useEffect(() => {
    void fetch("/api/merchant")
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { merchant?: Merchant | null } | null) => {
        const merchant = json?.merchant
        if (merchant) {
          setName(merchant.name)
          setTagline(merchant.tagline)
          setAbout(merchant.about)
          setWebsite(merchant.website)
          setLogo(merchant.logo)
          setLive(merchant.status === "live")
          setIsPublic(merchant.isPublic)
          setSlug(merchant.slug)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  function onLogoFile(file: File | undefined) {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use a PNG, JPEG, or WebP logo.")
      return
    }
    if (file.size > 250_000) {
      toast.error("Logo must be under 250 KB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (!result) {
        toast.error("Could not read that image.")
        return
      }
      setLogo(result)
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    setPending(true)
    try {
      const response = await fetch("/api/merchant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tagline,
          about,
          website,
          logo,
          status: live ? "live" : "draft",
          isPublic: live && isPublic,
        }),
      })
      const payload = (await response.json()) as {
        merchant?: Merchant
        error?: string | { message?: string }
      }
      if (!response.ok || !payload.merchant) {
        toast.error(errorMessage(payload) ?? "Could not save brand.")
        return
      }
      setSlug(payload.merchant.slug)
      setLive(payload.merchant.status === "live")
      setIsPublic(payload.merchant.isPublic)
      toast.success(
        payload.merchant.isPublic
          ? "Brand is on the marketplace."
          : payload.merchant.status === "live"
            ? "Brand published. Turn on Show on marketplace to list it."
            : "Brand saved as a draft."
      )
    } finally {
      setPending(false)
    }
  }

  if (!loaded) {
    return <p className="text-muted-foreground text-sm">Loading brand…</p>
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div>
        <h2 className="font-heading text-3xl">Merchant Register</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Your brand is a shopfront for listings you already publish. Hire still
          uses the same agent and worker cards.
        </p>
      </div>
      <FieldGroup className="gap-4">
        <Field className="gap-1">
          <FieldLabel htmlFor="brand-name">Brand name</FieldLabel>
          <Input
            id="brand-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Northstar Research"
            required
            maxLength={80}
          />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="brand-logo">Logo</FieldLabel>
          <Input
            id="brand-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onLogoFile(event.target.files?.[0])}
          />
          <FieldDescription>PNG, JPEG, or WebP. 250 KB max.</FieldDescription>
          {logo ? (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt=""
                className="size-12 rounded-lg object-contain ring-1 ring-border"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setLogo("")}
              >
                Remove
              </Button>
            </div>
          ) : null}
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="brand-tagline">Tagline</FieldLabel>
          <Input
            id="brand-tagline"
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            placeholder="Cited memos for operators"
            maxLength={160}
          />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="brand-about">About</FieldLabel>
          <Textarea
            id="brand-about"
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            rows={4}
            className="min-h-20 field-sizing-fixed"
            placeholder="Who this brand is and what its agents research."
            maxLength={2000}
          />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="brand-website">Website</FieldLabel>
          <Input
            id="brand-website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://example.com"
            maxLength={300}
          />
        </Field>
        <Field orientation="horizontal">
          <div className="min-w-0">
            <FieldLabel htmlFor="brand-live">Publish brand</FieldLabel>
            <FieldDescription>
              Live brand page. It stays private until you show it on the
              marketplace.
            </FieldDescription>
          </div>
          <Switch
            id="brand-live"
            checked={live}
            onCheckedChange={(checked) => {
              setLive(checked)
              if (!checked) setIsPublic(false)
            }}
          />
        </Field>
        <Field orientation="horizontal">
          <div className="min-w-0">
            <FieldLabel htmlFor="brand-public">Show on marketplace</FieldLabel>
            <FieldDescription>
              Lists this brand under Marketplace → Brands. People who open it
              see your public agents.
            </FieldDescription>
          </div>
          <Switch
            id="brand-public"
            checked={live && isPublic}
            disabled={!live}
            onCheckedChange={setIsPublic}
          />
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save brand"}
        </Button>
        {live && slug ? (
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/marketplace/brands/${slug}`} />}
          >
            View brand
          </Button>
        ) : null}
      </div>
    </form>
  )
}
