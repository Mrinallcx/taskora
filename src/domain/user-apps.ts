import { UserApp } from "@/src/db/models"
import { asObjectId, hex } from "@/src/lib/ids"

export async function ownedAppIds(userId: unknown, ids: unknown) {
  const raw = Array.isArray(ids) ? ids.map(String) : []
  const objectIds = raw
    .map((id) => asObjectId(id))
    .filter((id): id is NonNullable<typeof id> => Boolean(id))
    .slice(0, 40)
  if (objectIds.length === 0) return []
  const rows = await UserApp.find({ userId, _id: { $in: objectIds } }).select("_id")
  return rows.map((row) => hex(row._id))
}
