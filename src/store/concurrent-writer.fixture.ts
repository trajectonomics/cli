// Spawned by concurrency.test.ts as a separate `bun` process: argv is <home> <writer> <count>.
// Count 0 only opens the store, which is how concurrent first-opens are exercised. A refusal is
// printed as its envelope and sets a non-zero exit code; only src/index.ts calls process.exit.
import { type AppError, isAppError } from "../errors"
import { openStore, type Store } from "./index"

const [home = "", writer = "0", count = "0"] = process.argv.slice(2)

function failed(outcome: unknown): outcome is AppError {
	if (!isAppError(outcome)) return false
	console.error(JSON.stringify(outcome.body))
	process.exitCode = 1
	return true
}

function write(store: Store): void {
	const accounts = store.listAccounts({ sort: "name" })
	if (failed(accounts)) return
	const [cash, food] = accounts.map((a) => a.id)
	for (let n = 0; n < Number(count); n++) {
		// One valid Scenario v4 per write, distinct by its inflation step.
		const document = {
			schemaVersion: 4,
			currency: "THB",
			economy: { inflation: n },
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			flows: [],
			cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
		}
		if (failed(store.saveScenario({ name: "shared", document }))) {
			return
		}
		if (cash === undefined || food === undefined) continue
		const added = store.addTransaction({
			date: "2026-03-01",
			externalRef: `writer-${writer}-${n}`,
			postings: [
				{ accountId: food, amount: 100, currency: "THB" },
				{ accountId: cash, amount: -100, currency: "THB" },
			],
		})
		if (failed(added)) return
	}
}

const store = openStore({ env: { TRAJ_HOME: home }, clock: () => new Date() })
if (!failed(store)) {
	write(store)
	store.close()
}
