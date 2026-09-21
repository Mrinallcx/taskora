import { readFileSync } from "node:fs"

export function loadLocalEnv() {
  try {
    const text = readFileSync(".env.local", "utf8")
    for (const line of text.split("\n")) {
      if (!line || line.startsWith("#")) continue
      const index = line.indexOf("=")
      if (index < 0) continue
      const key = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim()
      process.env[key] = value
    }
  } catch {
    // Next.js already loads env for the web app.
  }
}
