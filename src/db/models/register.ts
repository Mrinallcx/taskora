import mongoose from "mongoose"

export const Schema = mongoose.Schema

export function registered(name: string, schema: mongoose.Schema) {
  if (process.env.NODE_ENV !== "production" && mongoose.models[name]) {
    const models = mongoose.models as Record<string, unknown>
    const live = mongoose.connection.models as Record<string, unknown>
    delete models[name]
    delete live[name]
  }
  return mongoose.models[name] || mongoose.model(name, schema)
}
