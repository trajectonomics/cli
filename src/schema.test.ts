import { describe, expect, it } from "bun:test"
import { type ErrorCode, registry } from "./errors"
import { capture } from "./test-support"

describe("schema", () => {
	it("lists the commands and the whole registry sorted by code", async () => {
		const res = await capture(["schema", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		const names = data.commands.map((c: { name: string }) => c.name)
		expect(names).toEqual([
			"account add",
			"account close",
			"account list",
			"account show",
			"help",
			"init",
			"schema",
			"tx add",
			"tx list",
			"tx show",
			"version",
		])
		const codes = data.errors.map((e: { code: string }) => e.code)
		expect(codes).toEqual([...codes].sort())
		expect(codes).toEqual(Object.keys(registry).sort())
		// The store's codes are listed although no shipped command raises them yet.
		for (const code of ["database_busy", "external_ref_conflict", "UNBALANCED_TRANSACTION"]) {
			expect(codes).toContain(code)
		}
		for (const entry of data.errors) {
			expect(entry.exitCode).toBe(registry[entry.code as ErrorCode].exit)
		}
	})

	it("describes one command: input, output, examples and error codes by reference", async () => {
		const res = await capture(["schema", "init", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("init")
		expect(data.input.type).toBe("object")
		expect(data.output.properties.created.type).toBe("boolean")
		expect(data.examples.length).toBeGreaterThan(0)
		for (const code of data.errorCodes) expect(registry).toHaveProperty(code)
	})

	it("every command's listed error codes exist in the registry", async () => {
		for (const name of ["help", "init", "schema", "version"]) {
			const data = JSON.parse((await capture(["schema", name, "--json"])).out)
			for (const code of data.errorCodes) expect(registry).toHaveProperty(code)
		}
	})

	it("rejects an unknown command name with unknown_command", async () => {
		const res = await capture(["schema", "nope", "--json"])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error.code).toBe("unknown_command")
	})

	it("renders the listing as readable text by default", async () => {
		const res = await capture(["schema"])
		expect(res.code).toBe(0)
		expect(res.out).toContain("unknown_command")
	})
})
