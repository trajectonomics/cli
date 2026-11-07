// Spawned by concurrency.test.ts as a separate `bun` process: argv is <home> <writer> <count>.
// Count 0 only opens the store, which is how concurrent first-opens are exercised.
import { isAppError } from "../errors"
import { openStore } from "./index"

const [home = "", writer = "0", count = "0"] = process.argv.slice(2)
const store = openStore({ env: { TRAJ_HOME: home }, clock: () => new Date() })
if (isAppError(store)) {
	console.error(JSON.stringify(store.body))
	process.exit(1)
}

function check(outcome: unknown): void {
	if (!isAppError(outcome)) return
	console.error(JSON.stringify(outcome.body))
	process.exit(1)
}

const accounts = store.listAccounts({ sort: "name" })
check(accounts)
const [cash, food] = isAppError(accounts) ? [] : accounts.map((a) => a.id)
for (let n = 0; n < Number(count); n++) {
	check(store.saveScenario({ name: "shared", document: { schemaVersion: 1, writer, n } }))
	if (cash === undefined || food === undefined) continue
	check(
		store.addTransaction({
			date: "2026-03-01",
			externalRef: `writer-${writer}-${n}`,
			postings: [
				{ accountId: food, amount: 100, currency: "THB" },
				{ accountId: cash, amount: -100, currency: "THB" },
			],
		}),
	)
}
store.close()
