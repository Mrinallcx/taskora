# LobeHub — what to take, what to skip

Reviewed 2026-09-15 against [lobehub/lobehub](https://github.com/lobehub/lobehub).

**Decision:** use LobeHub for **product ideas**. Do not fork it, copy source, or restyle their UI as ours.

## What it is

LobeHub is a personal / team AI workspace: chat, agent builder, agent groups, MCP plugins, schedule, memory. They call it a “Chief Agent Operator” — hire, schedule, and report on an AI team.

The pitch sounds close to this product. The architecture is not.

## Comparison

| | LobeHub | This app |
|---|---|---|
| Product | Chat workspace + agent OS | Research marketplace with jobs, escrow, payouts |
| “Marketplace” | Prompt / persona templates | Listings people hire, priced in cents |
| Runtime | Chat + MCP tools | Lead → worker → evaluator job machine |
| Stack | Next + Vite SPA, Drizzle / Postgres, Zustand, Ant Design | Next App Router, Clerk, Mongo / Mongoose, shadcn |
| License | **Community License** — commercial **derivatives need their license** | Our own product |

## License (hard stop)

Their LICENSE is Apache 2.0 **plus** extra terms:

- Shipping **unmodified** LobeHub as a service is allowed.
- Building a product on a **modified copy** requires a commercial license from LobeHub (`hello@lobehub.com`).

Do not copy source, fork into this repo, or restyle their UI as ours.

`@lobehub/ui` is MIT. Still skip it: it is a second design system on top of shadcn / Ant Design.

## Worth taking as ideas (rebuild, don’t paste)

- **Agent as the unit of work** — listing + schedule + report. Already started on Launch Agent.
- **Schedule while you’re away** — cadence + delivery email. They also notify in Slack / Discord (IM gateway). Useful later, not v1.
- **Agent groups** — closest analog to our lead / worker / eval swarm. Steal the *user story* (assemble a team for a task), not their chat-group code.
- **Job / report UX** — live status, cited memo, “what ran while you were gone.” Their operator view is a good reference for `/jobs/[id]`.
- **Skill catalog UX** — how they present tools. Keep our short allowlist (web search / fetch / stocks / crypto), not 10k MCP plugins.

## Do not pull in

- `@lobehub/ui` / Ant Design
- Their Postgres / Drizzle models, tRPC, Zustand slices
- MCP marketplace, community agent index, personal memory, IM gateway
- Their worker / chat loop — no escrow, citations, snapshots, or SSRF rules

Those fight the locked v1: research-only, Cerebras, Mongo transactions, play-money payouts.

## What to do instead

Keep building this app. If something in LobeHub is useful, copy the *behavior* into our job / listing model.

Overlap that already matches this product:

- Publish an agent
- Run now or on a cadence
- Show the memo
- Email on deliver

The next Lobe-shaped piece that fits **this** product is a clearer “your AI team / last runs” dashboard, not a chat OS.
