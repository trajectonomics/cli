import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { defineCommand, defineGroup, ok } from "./command"
import { SENTENCES } from "./sentences"
import { capture, errorOf } from "./test-support"
import { ledgerHome } from "./tx-test-support"

const probeLeaf = (name: string, input: z.ZodObject, positionals: readonly string[] = []) =>
	defineCommand({
		name,
		summary: `Lint ${name}`,
		positionals,
		input,
		output: z.unknown(),
		examples: [],
		errorCodes: [],
		run: (parsed) => ok(parsed),
	})

const probe = defineGroup({
	name: "probe",
	summary: "Validation fixture",
	children: [
		probeLeaf("required", z.strictObject({ title: z.string() })),
		probeLeaf("positional", z.strictObject({ word: z.string() }), ["word"]),
		probeLeaf("empty", z.strictObject({ word: z.string().min(1) })),
		probeLeaf("number", z.strictObject({ n: z.number() })),
		probeLeaf("whole", z.strictObject({ n: z.number().int() })),
		probeLeaf("range", z.strictObject({ n: z.number().min(2) })),
		probeLeaf("too-big", z.strictObject({ word: z.string().max(2) })),
		probeLeaf("choice", z.strictObject({ kind: z.enum(["a", "b"]) })),
	],
})

const probeRoot = defineGroup({ name: "traj", summary: "fixture", children: [probe] })
const runProbe = (argv: string[]) => capture(["probe", ...argv, "--json"], {}, probeRoot)

describe("one case per validation reason", () => {
	it("names a missing flag as a flag, with the generic help hint", async () => {
		const error = errorOf(await runProbe(["required"]))
		expect(error).toMatchObject({
			path: "--title",
			message: SENTENCES.requiredFlag,
			hint: 'Run "traj help probe required" to see its flags.',
			details: [{ path: "--title", message: SENTENCES.requiredFlag }],
		})
	})

	it("names a missing positional as an argument", async () => {
		const error = errorOf(await runProbe(["positional"]))
		expect(error).toMatchObject({ path: "word", message: SENTENCES.requiredArgument })
	})

	it("gives an empty value its own sentence", async () => {
		const error = errorOf(await runProbe(["empty", "--word", ""]))
		expect(error).toMatchObject({ path: "--word", message: SENTENCES.empty })
	})

	it("gives a non-numeric number the number sentence", async () => {
		const error = errorOf(await runProbe(["number", "--n", "abc"]))
		expect(error).toMatchObject({ path: "--n", message: SENTENCES.number })
	})

	it("gives a non-integral number the whole-number sentence", async () => {
		const error = errorOf(await runProbe(["whole", "--n", "1.5"]))
		expect(error).toMatchObject({ path: "--n", message: SENTENCES.wholeNumber })
	})

	it("gives a value below its minimum the range sentence", async () => {
		const error = errorOf(await runProbe(["range", "--n", "1"]))
		expect(error).toMatchObject({ path: "--n", message: SENTENCES.range })
	})

	it("gives an over-long string the range sentence", async () => {
		const error = errorOf(await runProbe(["too-big", "--word", "abc"]))
		expect(error).toMatchObject({ path: "--word", message: SENTENCES.range })
	})

	it("gives a value off the list the choice sentence, naming the allowed values", async () => {
		const error = errorOf(await runProbe(["choice", "--kind", "c"]))
		expect(error).toMatchObject({
			path: "--kind",
			message: "The value is not one of the allowed choices: a, b.",
		})
	})

	it("gives a missing required enum the required-flag sentence, not a choice", async () => {
		const error = errorOf(await runProbe(["choice"]))
		expect(error).toMatchObject({ path: "--kind", message: SENTENCES.requiredFlag })
	})

	it("drops a repeated flag's index from its path", async () => {
		const error = errorOf(
			await capture(
				[
					"projection",
					"compare",
					"a",
					"--as-of",
					"2026-03-31",
					"--horizon",
					"2027-03-30",
					"--age",
					"1.5",
					"--json",
				],
				{ TRAJ_HOME: ledgerHome() },
			),
		)
		expect(error).toMatchObject({ path: "--age", message: SENTENCES.wholeNumber })
		expect(error.details).toEqual([{ path: "--age", message: SENTENCES.wholeNumber }])
	})
})

describe("parser failures name only a leaf's own flag", () => {
	it("gives a flag missing its value the flag's path", async () => {
		const error = errorOf(
			await capture(["balance", "--as-of", "--json"], { TRAJ_HOME: ledgerHome() }),
		)
		expect(error).toMatchObject({ path: "--as-of", message: "Flag --as-of needs a value." })
	})

	it("leaves a global flag path-less", async () => {
		const error = errorOf(
			await capture(["balance", "--json=yes"], { TRAJ_HOME: ledgerHome(), TRAJ_FORMAT: "json" }),
		)
		expect(error.path).toBeUndefined()
		expect(error.message).toBe("Flag --json takes no value.")
	})

	it("leaves a group parse path-less", async () => {
		const error = errorOf(
			await capture(["tx", "--json=yes"], { TRAJ_HOME: ledgerHome(), TRAJ_FORMAT: "json" }),
		)
		expect(error.path).toBeUndefined()
	})

	it("keeps an extra word path-less, with its own hint", async () => {
		const error = errorOf(
			await capture(["balance", "--as-of", "2026-03-31", "extra", "--json"], {
				TRAJ_HOME: ledgerHome(),
			}),
		)
		expect(error).toMatchObject({
			message: "Unexpected argument: extra",
			hint: 'Run "traj help balance" to see its input.',
		})
		expect(error.path).toBeUndefined()
	})
})
