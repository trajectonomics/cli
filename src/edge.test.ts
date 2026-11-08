import { describe, expect, it } from "bun:test"
import { capture } from "./test-support"
import { fixtureRoot } from "./test-tree"

const demo = (argv: string[]) => capture(argv, {}, fixtureRoot)
const errorOf = (res: { err: string }) => JSON.parse(res.err).error

describe("--version is a flag, not a word scan", () => {
	it("prints the version for --version and -v anywhere a flag is allowed", async () => {
		for (const argv of [["--version"], ["-v"], ["demo", "--version"], ["version", "-v"]]) {
			expect((await demo(argv)).out).toMatch(/^\d+\.\d+\.\d+/)
		}
	})

	it("treats -v after -- as a word, not a flag", async () => {
		const res = await demo(["demo", "echo", "--json", "--", "-v"])
		expect(JSON.parse(res.out).text).toBe("-v")
	})

	it("checks the command path first, so an unknown command stays unknown", async () => {
		const res = await demo(["nope", "-v", "--json"])
		expect(res.code).toBe(2)
		expect(errorOf(res).code).toBe("unknown_command")
	})
})

describe("number flags", () => {
	it("accepts plain integers and decimals", async () => {
		const res = await demo(["demo", "echo", "hi", "--times=3", "--json"])
		expect(JSON.parse(res.out).times).toBe(3)
	})

	it("accepts a negative number as a separate value", async () => {
		const res = await demo(["demo", "echo", "hi", "--times", "-2", "--json"])
		expect(JSON.parse(res.out).times).toBe(-2)
	})

	it("rejects hex, exponent and Infinity spellings", async () => {
		for (const value of ["0x10", "1e3", "Infinity", "", " "]) {
			const res = await demo(["demo", "echo", "hi", `--times=${value}`, "--json"])
			expect(errorOf(res).code).toBe("invalid_input")
			expect(errorOf(res).path).toBe("times")
		}
	})
})

describe("parser errors are ours, not Node's wording", () => {
	it("gives a single-line message when a flag lacks its value", async () => {
		const res = await demo(["demo", "echo", "hi", "--from-date", "--json"])
		const { code, message, hint } = errorOf(res)
		expect(code).toBe("invalid_input")
		expect(message).toBe("Flag --from-date needs a value.")
		expect(hint).toBe('Run "traj help demo echo" to see its flags.')
	})

	it("explains a value given to a flag that takes none", async () => {
		const res = await demo(["demo", "echo", "hi", "--upper=yes", "--json"])
		expect(errorOf(res).message).toBe("Flag --upper takes no value.")
	})

	it("points an unknown flag at the command's own help", async () => {
		const res = await demo(["demo", "echo", "hi", "--bogus", "--json"])
		expect(errorOf(res).hint).toBe('Run "traj help demo echo" to see its flags.')
	})
})

describe("empty words", () => {
	it("keeps an empty positional word as an empty value", async () => {
		const res = await demo(["demo", "echo", "", "--json"])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out).text).toBe("")
	})
})

describe("usage shows what is optional and repeatable", () => {
	it("marks optional and variadic positionals", async () => {
		expect((await demo(["help", "help"])).out).toContain("Usage: traj help [path...]")
		expect((await demo(["help", "demo", "echo"])).out).toContain("<word>")
	})

	it("joins flag notes without stray punctuation", async () => {
		const out = (await demo(["help", "demo", "echo"])).out
		expect(out).toContain("A label; repeatable")
		expect(out).not.toContain(".;")
	})
})
