import mongoose from "mongoose"

export const Schema = mongoose.Schema

export function registered(name: string, schema: mongoose.Schema) {
  return mongoose.models[name] || mongoose.model(name, schema)
}
