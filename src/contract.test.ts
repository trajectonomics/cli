import { describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import { defineCommand, defineGroup } from "./command"
import { type ErrorCode, isAppError, registry } from "./errors"
import { FIXTURE_AS_OF, fixtureHome } from "./ledger-fixture"
import { type StoreRaised, storeTriggers, type Trigger } from "./store/store-triggers"
import { SCENARIO_DOCUMENT, tempHome } from "./store/testing"
import { type Captured, capture } from "./test-support"

/**
 * Runs a store trigger and returns its AppError from a test-only `probe` command, so the envelope
 * and exit code still come from the real `run()`. No shipped command raises these codes yet.
 */
function probed(
	triggers: Record<StoreRaised, Trigger>,
): Record<StoreRaised, () => Promise<Captured>> {
	const entries = Object.entries(triggers).map(([code, trigger]) => [
		code,
		async () => {
			const outcome = await (trigger as Trigger)()
			if (!isAppError(outcome)) throw new Error(`${code}: the trigger did not fail`)
			const probe = defineCommand({
				name: "probe",
				summary: "Return a store failure",
				positionals: [],
				input: z.strictObject({}),
				output: z.null(),
				examples: [],
				errorCodes: [],
				run: () => outcome,
			})
			const root = defineGroup({ name: "traj", summary: "probe tree", children: [probe] })
			return capture(["probe", "--json"], {}, root)
		},
	])
	return Object.fromEntries(entries) as Record<StoreRaised, () => Promise<Captured>>
}

describe("contract", () => {
	// Typed over ErrorCode: registering a new code fails to compile until a trigger is added here.
	const triggers: Record<ErrorCode, () => Promise<{ code: number; err: string }>> = {
		internal: () => {
			const file = join(mkdtempSync(join(tmpdir(), "traj-test-")), "afile")
			writeFileSync(file, "")
			return capture(["init", "--json"], { TRAJ_HOME: file })
		},
		invalid_input: () => capture(["version", "extra", "--json"]),
		unknown_command: () => capture(["nope", "--json"]),
		unknown_flag: () => capture(["--nope", "--json"]),
		// An unknown format is reported in text by design, so read the code from the text.
		unknown_format: () => capture(["version"], { TRAJ_FORMAT: "yaml" }),
		account_name_taken: async () => {
			const home = tempHome()
			const argv = ["account", "add", "Cash", "--type", "asset", "--currency", "THB", "--json"]
			await capture(argv, { TRAJ_HOME: home })
			return capture(argv, { TRAJ_HOME: home })
		},
		not_found: () => capture(["account", "show", "Nope", "--json"], { TRAJ_HOME: tempHome() }),
		projection_refused: async () => {
			const home = fixtureHome()
			await capture(
				["scenario", "apply", "base", "--file", "-", "--json"],
				{ TRAJ_HOME: home },
				undefined,
				JSON.stringify(SCENARIO_DOCUMENT),
			)
			return capture(
				[
					"projection",
					"run",
					"--scenario",
					"base",
					"--as-of",
					FIXTURE_AS_OF,
					"--horizon",
					"2027-03-30",
					"--json",
				],
				{ TRAJ_HOME: home },
			)
		},
		output_exists: async () => {
			const out = join(mkdtempSync(join(tmpdir(), "traj-test-")), "out")
			mkdirSync(out)
			return capture(["export", "--out", out, "--json"], { TRAJ_HOME: tempHome() })
		},
		export_failed: async () => {
			const file = join(mkdtempSync(join(tmpdir(), "traj-test-")), "afile")
			writeFileSync(file, "")
			return capture(["export", "--out", join(file, "out"), "--json"], { TRAJ_HOME: tempHome() })
		},
		scenario_name_taken: async () => {
			const home = tempHome()
			const apply = ["scenario", "apply", "base", "--file", "-", "--json"]
			await capture(apply, { TRAJ_HOME: home }, undefined, JSON.stringify(SCENARIO_DOCUMENT))
			return capture(["scenario", "fork", "base", "base", "--json"], { TRAJ_HOME: home })
		},
		...probed(storeTriggers),
	}

	it("makes every envelope's exitCode equal the value run() returns", async () => {
		for (const code of Object.keys(registry) as ErrorCode[]) {
			const res = await triggers[code]()
			expect(res.code).toBe(registry[code].exit)
			if (code === "unknown_format") {
				expect(res.err).toContain(code)
				continue
			}
			const { error } = JSON.parse(res.err)
			expect(error.code).toBe(code)
			expect(error.exitCode).toBe(res.code)
		}
	})

	it("gives byte-identical output for identical arguments", async () => {
		for (const argv of [["schema"], ["schema", "init", "--json"], ["help"], ["nope", "--json"]]) {
			const first = await capture(argv)
			const second = await capture(argv)
			expect(second).toEqual(first)
		}
	})

	it("adds a diagnostic to stderr only when TRAJ_DEBUG=1 asks for it", async () => {
		const file = join(mkdtempSync(join(tmpdir(), "traj-test-")), "afile")
		writeFileSync(file, "")
		const quiet = await capture(["init", "--json"], { TRAJ_HOME: file })
		const loud = await capture(["init", "--json"], { TRAJ_HOME: file, TRAJ_DEBUG: "1" })
		expect(quiet.err.split("\n")).toHaveLength(1)
		expect(loud.err.split("\n").length).toBeGreaterThan(1)
		expect(loud.err.split("\n").at(-1)).toBe(quiet.err)
	})
})
