export function timeoutMs(type: string) {
  const live = process.env.AGENT_PROVIDER === "cerebras"
  if (type === "plan") return live ? 180_000 : 120_000
  if (type === "evaluate") return live ? 300_000 : 180_000
  return live ? 480_000 : 300_000
}
