"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DashboardBackLink } from "@/components/dashboard-tabs"
import { OutputExport } from "@/components/output-export"
import { PriceHistoryChart, type PriceSeries } from "@/components/price-history-chart"
import { ReportMarkdown, stripSourcesSection } from "@/components/report-markdown"
import { ResearchOrb } from "@/components/research-orb"
import { formatExportWhen } from "@/src/domain/export-output"
import { formatResponseTime } from "@/src/domain/job-run-stats"
import { isResearchingStatus } from "@/src/domain/research-orb"
import { stockJobAssignmentCopy } from "@/src/domain/stock-workers"

type Citation = { url?: string; quote?: string; snapshotId?: string }
type Artifact = {
  _id: string
  taskId: string
  markdown?: string
  payload?: { markdown?: string; notes?: string }
  citations?: Citation[]
}
type TaskPayload = {
  job: {
    _id: string
    status: string
    name?: string
    brief: string
    instructions?: string
    domain: string
    budgetCents: number
    computeSpentCents: number
    cancelReason?: string
    createdAt?: string
    deliveredAt?: string
    category?: string
    workerId?: string
    workerQueued?: boolean
  }
  plan: { estimatedCostCents: number } | null
  tasks: { _id: string; type: string; status: string }[]
  artifacts: Artifact[]
  evaluations: { round: number; pass: boolean; hardFails: string[]; comments: string }[]
  events?: { type?: string }[]
  staffing?: string
  runStats?: {
    at?: string | null
    responseMs?: number | null
    inputTokens?: number | null
    outputTokens?: number | null
    totalTokens?: number | null
  }
}

function artifactBody(row: Artifact) {
  return String(row.payload?.markdown ?? row.payload?.notes ?? row.markdown ?? "").trim()
}

function latestFor(tasks: TaskPayload["tasks"], artifacts: Artifact[], type: string) {
  const task = [...tasks].reverse().find((row) => row.type === type)
  if (!task) return null
  const matches = artifacts.filter((row) => String(row.taskId) === String(task._id))
  return matches.at(-1) ?? null
}

export function TaskView({
  id,
  backHref,
  backLabel,
  staffing,
}: {
  id: string
  backHref?: string
  backLabel?: string
  staffing?: string
}) {
  const [data, setData] = useState<TaskPayload | null>(null)
  const [loadError, setLoadError] = useState("")
  const [chart, setChart] = useState<{
    label: string
    symbol: string
    kind?: "stock" | "crypto"
    provider?: string
    window?: string
    range?: string
    data: { month: string; price: number }[]
    series?: PriceSeries[]
  } | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartImage, setChartImage] = useState("")

  const load = useCallback(async () => {
    const response = await fetch(`/api/jobs/${id}`)
    if (response.ok) {
      setLoadError("")
      setData(await response.json())
      return
    }
    setLoadError(
      response.status === 404
        ? "This task is not on your account. The Grok Bot test created it as a script user, so it will not open while you are signed in."
        : "Could not load this task."
    )
  }, [id])

  useEffect(() => {
    setChartImage("")
    void load()
    const timer = setInterval(() => void load(), 2000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!data?.job || data.job.domain !== "finance") return
    let cancelled = false
    setChartLoading(true)
    void fetch(`/api/jobs/${id}/chart`)
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (payload: {
          chart?: {
            label: string
            symbol: string
            kind?: "stock" | "crypto"
            provider?: string
            window?: string
            range?: string
            data: { month: string; price: number }[]
            series?: PriceSeries[]
          } | null
        } | null) => {
          if (!cancelled && payload?.chart?.data?.length) setChart(payload.chart)
        }
      )
      .finally(() => {
        if (!cancelled) setChartLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, data?.job?.domain])

  async function post(path: string) {
    const response = await fetch(path, { method: "POST" })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(json.error?.message ?? "Request failed")
      return
    }
    await load()
  }

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
        {backHref ? (
          <DashboardBackLink href={backHref} label={backLabel || "Back"} />
        ) : null}
        <p className="text-muted-foreground text-sm">
          {loadError || "Loading task…"}
        </p>
      </div>
    )
  }

  const { job, plan, tasks, artifacts = [] } = data
  const overBudget = Boolean(plan && plan.estimatedCostCents > job.budgetCents)
  const showActions = [
    "draft",
    "planning",
    "plan_review",
    "in_progress",
    "evaluating",
    "revision",
  ].includes(job.status)
  const report = latestFor(tasks, artifacts, "report")
  const findings = latestFor(tasks, artifacts, "findings")
  const sources = latestFor(tasks, artifacts, "sources")
  const memo = report ? artifactBody(report) : ""
  const notes = artifactBody(findings ?? sources ?? { _id: "", taskId: "", markdown: "" })
  const waitingGrok = Boolean(
    !memo &&
      data.events?.some((event) =>
        ["grok_bot_dispatched", "grok_bot_pinged"].includes(String(event.type ?? ""))
      )
  )
  const citations = (report?.citations ?? sources?.citations ?? []).filter((row) => row.url)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      {backHref ? (
        <DashboardBackLink href={backHref} label={backLabel || "Back"} />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge>{job.status.replaceAll("_", " ")}</Badge>
            <span className="text-muted-foreground text-sm">{job.domain}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">{job.brief}</p>
          <p className="text-muted-foreground mt-3 text-sm">
            {["delivered", "settled"].includes(job.status) ? "Done by" : "By"}{" "}
            <span className="text-foreground font-medium">
              {job.name?.trim() || "Research desk"}
            </span>
          </p>
          {isResearchingStatus(job.status) &&
          (job.workerQueued ||
            job.workerId ||
            job.category === "stocks" ||
            job.category === "crypto") ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
              <ResearchOrb startedAt={job.createdAt} />
              {stockJobAssignmentCopy(job)}
            </p>
          ) : null}
          {job.deliveredAt || job.createdAt ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {formatExportWhen(new Date(job.deliveredAt ?? job.createdAt ?? Date.now()))}
            </p>
          ) : null}
          {data.runStats?.responseMs != null || data.runStats?.totalTokens != null ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.runStats.responseMs != null ? (
                <div>
                  <dt className="text-muted-foreground text-xs">Total response time</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums">
                    {formatResponseTime(data.runStats.responseMs)}
                  </dd>
                </div>
              ) : null}
              {data.runStats.totalTokens != null ? (
                <>
                  <div>
                    <dt className="text-muted-foreground text-xs">Input tokens</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">
                      {(data.runStats.inputTokens ?? 0).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Output tokens</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">
                      {(data.runStats.outputTokens ?? 0).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Total tokens</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">
                      {data.runStats.totalTokens.toLocaleString()}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          ) : null}
          {job.cancelReason ? (
            <p className="text-muted-foreground mt-1 text-sm">{job.cancelReason}</p>
          ) : null}
        </div>
        {showActions ? (
          <div className="flex flex-wrap gap-2">
            {job.status === "draft" ? (
              <Button onClick={() => post(`/api/jobs/${id}/fund`)}>Fund</Button>
            ) : null}
            {job.status === "plan_review" ? (
              <Button disabled={overBudget} onClick={() => post(`/api/jobs/${id}/approve-plan`)}>
                Approve plan
              </Button>
            ) : null}
            {job.status !== "draft" ? (
              <Button variant="destructive" onClick={() => post(`/api/jobs/${id}/stop`)}>
                Stop
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Output</CardTitle>
          <CardDescription>
            {memo
              ? "Cited memo"
              : notes
                ? "Working notes — memo follows"
                : job.workerQueued
                  ? "Waiting for a worker."
                  : waitingGrok
                    ? "Worker assigned"
                    : "Memo and sources show here."}
          </CardDescription>
          <CardAction>
            <OutputExport
              agentName={job.name?.trim() || "Research desk"}
              at={new Date(job.deliveredAt ?? job.createdAt ?? Date.now())}
              brief={job.brief}
              instructions={job.instructions}
              memo={memo || notes}
              citations={citations}
              series={
                chart
                  ? chart.series?.length
                    ? chart.series
                    : [{ label: chart.label, symbol: chart.symbol, data: chart.data }]
                  : undefined
              }
              chartImage={chartImage || undefined}
              domain={job.domain}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {chart && job.domain === "finance" ? (
            <PriceHistoryChart
              title={chart.label}
              interval={chart.window ?? "1 year"}
              provider={chart.provider}
              kind={chart.kind}
              series={
                chart.series?.length
                  ? chart.series
                  : [{ label: chart.label, symbol: chart.symbol, data: chart.data }]
              }
              onChartImage={(url) => {
                setChartImage((prev) => (prev === url ? prev : url))
              }}
            />
          ) : job.domain === "finance" && chartLoading ? (
            <p className="text-muted-foreground text-sm">Loading price chart…</p>
          ) : null}
          {memo || notes ? (
            <ReportMarkdown
              text={
                citations.length > 0
                  ? stripSourcesSection(memo || notes)
                  : memo || notes
              }
              citations={citations}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing yet. Keep this page open — it refreshes on its own.
            </p>
          )}
          {citations.length > 0 ? (
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Sources
              </p>
              {citations.map((citation, index) => (
                <div key={`${citation.url}-${index}`} className="flex flex-col gap-0.5">
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-sm break-all underline-offset-2 hover:underline"
                  >
                    {citation.url}
                  </a>
                  {citation.quote ? (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {citation.quote}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {overBudget ? (
        <p className="text-sm text-destructive">
          Estimated cost exceeds budget. Stop the task or wait for a cheaper plan.
        </p>
      ) : null}
    </div>
  )
}
