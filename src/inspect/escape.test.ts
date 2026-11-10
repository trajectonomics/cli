import { describe, expect, it } from "bun:test"
import { tempHome } from "../store/testing"
import { capture } from "../test-support"

const accounts: [string, string][] = [
	["Cash", "asset"],
	["Food", "expense"],
]

describe("inspect's human table", () => {
	it("escapes a memo's newline, tab and terminal escape, and keeps it on one row", async () => {
		const home = tempHome()
		for (const [name, type] of accounts) {
			await capture(["account", "add", name, "--type", type, "--currency", "THB"], {
				TRAJ_HOME: home,
			})
		}
		const memo = "line\nbreak\ttab\u001b[31mred"
		const document = JSON.stringify({
			date: "2026-03-01",
			memo,
			postings: [
				{ account: "Food", amount: "10.00", currency: "THB" },
				{ account: "Cash", amount: "-10.00", currency: "THB" },
			],
		})
		const added = await capture(
			["tx", "add", "--postings", "-", "--json"],
			{ TRAJ_HOME: home },
			undefined,
			document,
		)
		expect(added.code).toBe(0)

		const res = await capture(["inspect", "tx"], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(res.out).toContain("line\\nbreak\\ttab\\u001b[31mred")
		expect(res.out).not.toContain("\u001b")
		// The heading, the column header and the one row: nothing broke the table.
		expect(res.out.split("\n")).toHaveLength(3)
	})
})

describe("inspect's description", () => {
	it("publishes the leaf and its five row schemas", async () => {
		const res = await capture(["schema", "inspect", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("inspect")
		expect(data.positionals).toEqual(["table"])
		expect(data.input.properties.table.type).toBe("string")
		expect(data.input.properties.all.type).toBe("boolean")
		const output = JSON.stringify(data.output)
		for (const column of ["dimensions", "contentHash", "correctionKind", "deletedAt"]) {
			expect(output).toContain(column)
		}
		for (const code of ["invalid_input", "database_busy", "database_too_new", "migration_failed"]) {
			expect(data.errorCodes).toContain(code)
		}
	})
})
