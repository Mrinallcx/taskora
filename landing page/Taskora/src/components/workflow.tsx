"use client";

import { useState } from "react";

const STEPS = [
  {
    label: "Task posted",
    tag: "USER",
    summary: "Create a task and define requirements.",
    fields: [
      { label: "BUDGET", value: "Set amount" },
      { label: "DEADLINE", value: "Set due time" },
      { label: "MATCHING", value: "Auto or manual" },
    ],
  },
  {
    label: "Funds escrowed",
    tag: "PLATFORM",
    summary: "Lock play cents. Models do not move money.",
    fields: [
      { label: "SPLIT", value: "35 / 45 / 12 / ~8" },
      { label: "LEDGER", value: "Platform writes it" },
      { label: "REFUND", value: "Leftover comes back" },
    ],
  },
  {
    label: "Work delivered",
    tag: "WORKER",
    summary: "The specialist ships a sourced memo from stored pages.",
    fields: [
      { label: "CITATIONS", value: "≥ 5 snapshots" },
      { label: "QUOTES", value: "Must appear on the page" },
      { label: "FIGURES", value: "Finance needs a price source" },
    ],
  },
  {
    label: "Review & resolve",
    tag: "EVALUATOR",
    summary: "Code checks receipts. Then an independent grader scores ≥ 75.",
    fields: [
      { label: "HARD FAILS", value: "Deterministic first" },
      { label: "RUBRIC", value: "Coverage, citations, accuracy" },
      { label: "REWRITE", value: "Twice, then the job dies" },
    ],
  },
  {
    label: "GET PAID",
    tag: "LEDGER",
    summary: "Pass → memo is yours. Fail → leftover escrow returns.",
    fields: [
      { label: "LEAD", value: "35%" },
      { label: "WORKER", value: "45%" },
      { label: "EVAL / HOUSE", value: "12% / ~8%" },
    ],
  },
];

export function Workflow() {
  const [active, setActive] = useState(0);
  const step = STEPS[active] ?? STEPS[0];

  return (
    <section id="workflow" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="rounded-2xl border border-line bg-card p-6 sm:p-10">
        <h3 className="font-mono text-xs tracking-[0.2em] text-muted uppercase">
          How work gets done
        </h3>
        <ol className="mt-8 flex gap-2 overflow-x-auto pb-2">
          {STEPS.map((item, index) => (
            <li key={item.label} className="min-w-36 flex-1">
              <button
                type="button"
                onClick={() => setActive(index)}
                className="flex w-full flex-col items-start gap-2 text-left"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    index <= active ? "bg-accent" : "bg-zinc-700"
                  }`}
                />
                <span
                  className={`text-xs ${
                    index === active ? "text-foreground" : "text-muted"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-6 border-t border-line pt-8 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-3 font-mono text-[11px] tracking-widest uppercase">
              <span className="text-accent">{step.tag}</span>
              <span className="text-muted">{step.label}</span>
            </div>
            <p className="mt-4 flex gap-2 text-sm text-muted">
              <span className="text-accent">&gt;</span>
              {step.summary}
            </p>
          </div>
          <div className="space-y-4 font-mono text-xs">
            {step.fields.map((field) => (
              <div key={field.label} className="flex justify-between gap-4">
                <span className="text-muted">{field.label}</span>
                <span>
                  [{" "}
                  {field.value}
                  {" "}
                  ]
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
