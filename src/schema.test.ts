import { describe, expect, it } from "bun:test"
import { type ErrorCode, registry } from "./errors"
import { RETRYABLE_CODES } from "./registry"
import { scenarioHome } from "./scenario-test-support"
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
			"backup",
			"balance",
			"baseline show",
			"data remove",
			"doctor",
			"export",
			"fi",
			"help",
			"init",
			"inspect",
			"projection compare",
			"projection run",
			"report networth",
			"report pnl",
			"restore",
			"scenario apply",
			"scenario diff",
			"scenario fork",
			"scenario list",
			"scenario rm",
			"scenario show",
			"scenario tax",
			"schema",
			"tx add",
			"tx amend",
			"tx import",
			"tx list",
			"tx show",
			"tx void",
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
			expect(entry.retryable).toBe(RETRYABLE_CODES.includes(entry.code as ErrorCode))
		}
		expect(
			data.errors.find((entry: { code: string }) => entry.code === "database_busy"),
		).toMatchObject({
			retryable: true,
		})
		expect(data.errors.find((entry: { code: string }) => entry.code === "disk_full")).toMatchObject(
			{
				retryable: true,
			},
		)
		expect(
			data.errors.find((entry: { code: string }) => entry.code === "output_exists"),
		).toMatchObject({
			retryable: false,
		})
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

describe("schema of the Scenario document", () => {
	it("publishes the shape, its units and one worked example a person can apply", async () => {
		const res = await capture(["schema", "scenario", "apply", "--json"])
		expect(res.code).toBe(0)
		const document = JSON.parse(res.out).document
		expect(Object.keys(document.schema.properties)).toEqual([
			"schemaVersion",
			"currency",
			"economy",
			"accounts",
			"flows",
			"cashflow",
			"levies",
			"calendar",
		])
		expect(document.schema.additionalProperties).toBe(false)
		expect(document.schema.description).toContain("minor units")
		expect(document.schema.description).toContain("basis points")
		expect(document.schema.description).toContain("check()")
		expect(document.schema.examples).toHaveLength(1)
		const applied = await capture(
			["scenario", "apply", "example", "--file", "-", "--dry-run", "--json"],
			{ TRAJ_HOME: scenarioHome() },
			undefined,
			JSON.stringify(document.schema.examples[0]),
		)
		expect(applied.code).toBe(0)
		expect(JSON.parse(applied.out).status).toBe("created")
	})
})

describe("what this version cannot do", () => {
	it("is listed on the root, with the limit and the way around it", async () => {
		const res = await capture(["schema", "--json"])
		expect(res.code).toBe(0)
		const entries = JSON.parse(res.out).notSupported as { feature: string; detail: string }[]
		const features = entries.map((entry) => entry.feature).join(" ")
		expect(features).toContain("currency other than THB")
		expect(features).toContain("Monte Carlo")
		expect(features).toContain("return shocks")
		expect(features).toContain("retirement date")
		for (const entry of entries) expect(entry.detail.length).toBeGreaterThan(20)
	})

	it("is not repeated on a group or a command, because it is a fact about the whole tool", async () => {
		for (const path of [["scenario"], ["init"]]) {
			const res = await capture(["schema", ...path, "--json"])
			expect(JSON.parse(res.out).notSupported).toBeUndefined()
		}
	})
})
