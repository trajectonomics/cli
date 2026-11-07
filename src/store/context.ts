import type { Database } from "bun:sqlite"
import type { Clock } from "./types"

/** What every store operation closes over. One write reads the clock exactly once. */
export type Ctx = { db: Database; clock: Clock; entityId: string }
