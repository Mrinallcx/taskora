"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DashboardBackLink } from "@/components/dashboard-tabs"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { ReportMarkdown, stripSourcesSection } from "@/components/report-markdown"

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
    brief: string
    instructions?: string
    domain: string
    budgetCents: number
    computeSpentCents: number
    cancelReason?: string
  }
  plan: { estimatedCostCents: number } | null
  tasks: { _id: string; type: string; status: string }[]
  artifacts: Artifact[]
  evaluations: { round: number; pass: boolean; hardFails: string[]; comments: string }[]
  events?: { type?: string }[]
  staffing?: string
  coverage?: { searches: number; stored: number; citable: number; cited: number }
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

const LABELS: Record<string, string> = {
  sources: "Sources",
  findings: "Notes",
  report: "Memo",
  evaluate: "Review",
}

const PIPELINE = ["Plan", "Research", "Memo", "Review"] as const

function pipelineStep(status: string, tasks: TaskPayload["tasks"]) {
  if (["delivered", "settled"].includes(status)) return 4
  if (["evaluating", "revision"].includes(status)) return 3
  if (tasks.some((task) => task.type === "report" && task.status !== "queued")) return 2
  if (status === "in_progress") return 1
  if (status === "cancelled") return -1
  return 0
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
    provider?: string
    window?: string
    range?: string
    data: { month: string; price: number }[]
  } | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

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
            provider?: string
            window?: string
            range?: string
            data: { month: string; price: number }[]
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
  const hiredLine = data.staffing || staffing
  const overBudget = Boolean(plan && plan.estimatedCostCents > job.budgetCents)
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
  const current = pipelineStep(job.status, tasks)
  const running = !["delivered", "settled", "cancelled"].includes(job.status)

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
          <h2 className="font-heading mt-2 text-2xl">{job.brief}</h2>
          {job.instructions?.trim() ? (
            <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
              {job.instructions.trim()}
            </p>
          ) : null}
          {hiredLine ? (
            <p className="text-muted-foreground mt-1 text-sm">{hiredLine}</p>
          ) : null}
          {data.coverage ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {data.coverage.searches} searches · {data.coverage.citable} pages stored ·{" "}
              {data.coverage.cited} cited
            </p>
          ) : null}
          {job.cancelReason ? (
            <p className="text-muted-foreground mt-1 text-sm">{job.cancelReason}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status === "draft" ? (
            <Button onClick={() => post(`/api/jobs/${id}/fund`)}>Fund</Button>
          ) : null}
          {job.status === "plan_review" ? (
            <Button disabled={overBudget} onClick={() => post(`/api/jobs/${id}/approve-plan`)}>
              Approve plan
            </Button>
          ) : null}
          {job.status === "delivered" ? (
            <>
              <Button onClick={() => post(`/api/jobs/${id}/accept`)}>Accept</Button>
              <Button variant="outline" onClick={() => post(`/api/jobs/${id}/dispute`)}>
                Dispute
              </Button>
            </>
          ) : null}
          {["planning", "plan_review", "in_progress", "evaluating", "revision"].includes(
            job.status
          ) ? (
            <Button variant="destructive" onClick={() => post(`/api/jobs/${id}/stop`)}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>
            {running
              ? waitingGrok
                ? "Grok Bot has the brief. Output appears below when it posts back."
                : "Agent is working. Output appears below as it lands."
              : "Run finished."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {PIPELINE.map((label, index) => {
              const done = current > index
              const active = current === index
              return (
                <Badge
                  key={label}
                  variant={done || active ? "secondary" : "outline"}
                >
                  {label}
                  {done ? " · done" : active && running ? " · now" : ""}
                </Badge>
              )
            })}
          </div>
          {tasks.length > 0 ? (
            <div className="flex flex-col gap-2 text-sm">
              {tasks.map((task) => (
                <div key={task._id} className="flex justify-between gap-3">
                  <span>{LABELS[task.type] ?? task.type}</span>
                  <span className="text-muted-foreground">
                    {task.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Waiting for the agent to start.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Output</CardTitle>
          <CardDescription>
            {memo
              ? "Cited memo"
              : notes
                ? "Working notes — memo follows"
                : waitingGrok
                  ? "Waiting on Grok Bot."
                  : "Memo and sources show here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {chart && job.domain === "finance" ? (
            <PriceHistoryChart
              title={`${chart.label} · ${chart.window ?? "1 year price"}`}
              description={`${chart.symbol} USD monthly close${chart.range ? ` · ${chart.range}` : ""}`}
              source={chart.provider}
              data={chart.data}
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
