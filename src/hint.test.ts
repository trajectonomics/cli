import { describe, expect, it } from "bun:test"
import { ACCOUNT_HINT, hintOf, TRANSACTION_HINT, UNKNOWN_ACCOUNT_HINT } from "./hint"
import { tempHome } from "./store/testing"
import { capture } from "./test-support"

describe("hint", () => {
	it("names the account sentence while the Ledger holds no Account", () => {
		expect(hintOf({ accounts: 0, transactions: 0 })).toBe(ACCOUNT_HINT)
		expect(hintOf({ accounts: 0, transactions: 2 })).toBe(ACCOUNT_HINT)
	})

	it("names the transaction sentence once an Account exists and no Transaction does", () => {
		expect(hintOf({ accounts: 2, transactions: 0 })).toBe(TRANSACTION_HINT)
	})

	it("says nothing once the store holds both kinds of row", () => {
		expect(hintOf({ accounts: 2, transactions: 1 })).toBeUndefined()
	})

	it("quotes an account command that succeeds on the ledger it was printed from", async () => {
		const home = tempHome()
		const created = await capture(["init", "--json"], { TRAJ_HOME: home })
		const { hint } = JSON.parse(created.out) as { hint: string }
		// The sentence quotes no argument containing a space, so splitting on them is exact.
		const quoted = hint.match(/^Run "(.+)" to create your first account\.$/)?.[1] ?? ""
		const argv = quoted.split(" ")
		expect(argv[0]).toBe("traj")
		expect((await capture([...argv.slice(1), "--json"], { TRAJ_HOME: home })).code).toBe(0)
		expect(
			JSON.parse((await capture(["account", "list", "--json"], { TRAJ_HOME: home })).out),
		).toMatchObject({
			accounts: [{ name: "Cash" }],
		})
	})

	it("names every flag traj tx add requires, so the sentence cannot go stale", async () => {
		const add = JSON.parse((await capture(["schema", "tx", "add", "--json"])).out) as {
			input: { required: string[] }
		}
		const named = [...TRANSACTION_HINT.matchAll(/--([a-z][a-z-]*)/g)].map((match) => match[1] ?? "")
		expect([...named].sort()).toEqual([...add.input.required].sort())
	})

	it("quotes the same account command in the UNKNOWN_ACCOUNT sentence", () => {
		const quoted = ACCOUNT_HINT.match(/"([^"]+)"/)?.[1] ?? ""
		expect(quoted).not.toBe("")
		expect(UNKNOWN_ACCOUNT_HINT).toContain(`"${quoted}"`)
	})
})
