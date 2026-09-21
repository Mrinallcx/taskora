# Multiagent

Research jobs: you fund a brief, a lead proposes a plan, a worker writes a cited memo, an evaluator scores it, and play-money escrow splits.

## Stack

- Next.js App Router + Clerk
- **MongoDB** (database `multiagent`) + Mongoose
- Fake agent runtime until you add `CEREBRAS_API_KEY`
- Play-money cents (new users get $1000)

## MongoDB

Use the MongoDB you already installed. Set `MONGODB_URI` in `.env.local`. When you have Atlas, replace it with the cloud URL — no code change.

**Replica set (needed for multi-document transactions on fund/settle):**

```bash
mongod --replSet rs0 --port 27017 --dbpath /data/db
# then
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

Or Docker:

```bash
docker compose up -d
node scripts/rs-initiate.js
```

If `mongod` is already running **standalone**, the app still runs: money writes retry without a session. Start a replica set when you want true transactions.

Default URI:

```text
mongodb://127.0.0.1:27017/multiagent
```

Replica URI:

```text
mongodb://127.0.0.1:27017/multiagent?replicaSet=rs0
```

## Env

Copy `.env.example` → `.env.local`. Required besides Clerk:

- `MONGODB_URI`
- `ENCRYPTION_KEY` — 64 hex chars (`openssl rand -hex 32`)
- `WORKER_SECRET`
- `AGENT_PROVIDER=fake` until Cerebras is live

## Run

```bash
pnpm install
pnpm seed
pnpm dev          # http://localhost:3000
pnpm worker       # claim loop in a second terminal
```

Sign in, open **Jobs**, create a tea-history brief, fund, wait for plan review, approve. Fake agents finish the DAG.

## Scripts

- `pnpm seed` — upsert `lead-research`, `worker-research`, `eval-research`
- `pnpm test` — Vitest (job machine, payouts, fake swarm)
- `pnpm typecheck`
