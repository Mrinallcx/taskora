import mongoose from "mongoose"

export function asObjectId(id: string) {
  if (!mongoose.isValidObjectId(id)) return null
  return new mongoose.Types.ObjectId(id)
}

export function hex(id: { toString(): string } | string) {
  return typeof id === "string" ? id : id.toString()
}
