import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { isAppError } from "../errors"
import { HEAD, openStore } from "./index"
import { must, mustOpen, steppingClock, tempHome } from "./testing"

const CHILD = join(import.meta.dir, "concurrent-writer.fixture.ts")

async function spawnWriters(home: string, writers: number, count: number) {
	const children = Array.from({ length: writers }, (_, writer) =>
		Bun.spawn([process.execPath, CHILD, home, String(writer), String(count)], {
			stdout: "pipe",
			stderr: "pipe",
		}),
	)
	return Promise.all(
		children.map(async (child) => ({
			code: await child.exited,
			err: await new Response(child.stderr).text(),
		})),
	)
}

function health(home: string) {
	const db = new Database(join(home, "traj.db"), { readonly: true })
	const result = {
		version: db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version,
		integrity: db.query("PRAGMA integrity_check").all(),
		foreignKeys: db.query("PRAGMA foreign_key_check").all(),
		entities: db.query("SELECT id FROM entity ORDER BY id").all().length,
	}
	db.close()
	return result
}

describe("concurrency", () => {
	it("lets concurrent first-opens all end at head with one seeded entity", async () => {
		const home = tempHome()
		const results = await spawnWriters(home, 8, 0)
		expect(results).toEqual(results.map(() => ({ code: 0, err: "" })))
		expect(health(home)).toEqual({
			version: HEAD,
			integrity: [{ integrity_check: "ok" }],
			foreignKeys: [],
			entities: 1,
		})
	})

	it("exits a writer process non-zero with the envelope when the store refuses it", async () => {
		const home = tempHome()
		mustOpen(home).close()
		const db = new Database(join(home, "traj.db"))
		db.run(`PRAGMA user_version = ${HEAD + 1}`)
		db.close()
		const [result] = await spawnWriters(home, 1, 1)
		expect(result?.code).toBe(1)
		expect(JSON.parse(result?.err ?? "")).toMatchObject({ code: "database_too_new" })
	})

	it("loses no write when N processes write in parallel", async () => {
		const home = tempHome()
		const setup = mustOpen(home)
		must(setup.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		must(setup.createAccount({ name: "Food", type: "expense", currency: "THB" }))
		setup.close()
		const [writers, count] = [8, 50]
		const results = await spawnWriters(home, writers, count)
		expect(results).toEqual(results.map(() => ({ code: 0, err: "" })))
		const store = mustOpen(home)
		const [shared] = must(store.listScenarios({ sort: "name" }))
		// The first save creates version 1 and every later save bumps it by exactly one.
		expect(shared?.version).toBe(writers * count)
		expect(must(store.listTransactions({ sort: "id" }))).toHaveLength(writers * count)
		expect(must(store.listPostings({ sort: "tx_id" }))).toHaveLength(2 * writers * count)
		store.close()
		const { integrity, foreignKeys } = health(home)
		expect(integrity).toEqual([{ integrity_check: "ok" }])
		expect(foreignKeys).toEqual([])
	}, 30_000)

	it("reports contention that outlives the busy timeout as a retryable conflict", () => {
		const home = tempHome()
		mustOpen(home).close()
		const holder = new Database(join(home, "traj.db"))
		holder.run("BEGIN IMMEDIATE")
		const store = openStore({ env: { TRAJ_HOME: home }, clock: steppingClock(), busyTimeoutMs: 20 })
		if (isAppError(store)) throw new Error(JSON.stringify(store.body))
		const outcome = store.createAccount({ name: "Cash", type: "asset", currency: "THB" })
		holder.run("ROLLBACK")
		holder.close()
		if (!isAppError(outcome)) throw new Error("expected database_busy")
		expect(outcome.body).toMatchObject({
			code: "database_busy",
			exitCode: 5,
			details: { retryable: true },
		})
		expect(must(store.listAccounts({ sort: "id" }))).toEqual([])
		store.close()
	})
})
