import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "./launcher-test-support"

const readme = readFileSync(join(ROOT, "README.md"), "utf8")

// The first screen is everything above the Development heading; the page most visitors read.
const SPLIT = "\n## Development\n"
const [firstScreen = "", development = ""] = readme.split(SPLIT)
const lowerFirstScreen = firstScreen.toLowerCase()

const installCommands = [
	"curl -fsSL https://github.com/trajectonomics/cli/releases/latest/download/install.sh | sh",
	"irm https://github.com/trajectonomics/cli/releases/latest/download/install.ps1 | iex",
	"npx @trajectonomics/cli@latest --version",
	"bunx @trajectonomics/cli@latest --version",
]

const skillCommand = "npx skills add trajectonomics/internal-skills --skill traj -y"

describe("the README first screen", () => {
	it("ends at the Development heading", () => {
		expect(readme).toContain(SPLIT)
	})

	it("says what traj is, who operates it, and that it never calls a model", () => {
		expect(firstScreen).toContain("free and open source")
		expect(firstScreen).toContain("command line for personal money")
		expect(firstScreen).toMatch(/an AI agent operates it/i)
		expect(firstScreen).toMatch(/never calls a model/i)
	})

	it("keeps the published install commands character for character", () => {
		for (const command of installCommands) {
			expect(firstScreen).toContain(command)
		}
	})

	it("adds the outsider skill step after the install commands and before the channels", () => {
		const at = firstScreen.indexOf(skillCommand)
		expect(at).toBeGreaterThan(firstScreen.indexOf("bunx @trajectonomics/cli@latest --version"))
		expect(at).toBeLessThan(firstScreen.indexOf("Which channel"))
		expect(at).toBeLessThan(firstScreen.indexOf("Uninstall"))
	})

	it("says the skill step needs Node, which the install scripts do not", () => {
		expect(firstScreen).toMatch(/needs Node/)
		expect(firstScreen).toMatch(/install scripts do not/)
	})

	it("leaves the Bun-only sentence to Development", () => {
		expect(firstScreen).not.toContain("Bun-only")
		expect(development).toContain("The sources are Bun-only; a released binary needs nothing.")
	})

	it("claims no tax meaning, offers no Homebrew, and links no site yet", () => {
		expect(lowerFirstScreen).not.toContain("tax")
		expect(lowerFirstScreen).not.toContain("thailand")
		expect(lowerFirstScreen).not.toContain("financial independence")
		expect(lowerFirstScreen).not.toContain("homebrew")
		expect(firstScreen).not.toContain("trajectonomics.com")
	})
})

describe("the README anywhere", () => {
	it("never sends a reader to the unscoped package", () => {
		expect(readme).not.toContain("npx traj")
		expect(readme).not.toContain("bunx traj")
	})
})
