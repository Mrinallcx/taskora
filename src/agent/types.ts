export type AgentInput = {
  kind: string
  type: string
  jobId: string
  round: number
  summary?: string
  instructions?: string
  skills?: string
  workerSkills?: string
  catalog?: string
  memo?: string
}
