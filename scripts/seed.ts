import { connect, disconnect } from "../src/db/connect"
import { ensurePlatformListings } from "../src/domain/platform-seed"
import { loadLocalEnv } from "../src/lib/load-env"

export async function seedListings() {
  await connect()
  await ensurePlatformListings()
}

const isMain = process.argv[1]?.includes("seed")
if (isMain) {
  loadLocalEnv()
  seedListings()
    .then(async () => {
      console.log(
        "Seeded lead-research, worker-research, eval-research, research-handoff"
      )
      await disconnect()
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
