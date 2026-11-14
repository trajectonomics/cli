import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "./launcher-test-support"

const readme = readFileSync(join(ROOT, "README.md"), "utf8")

// The first screen is everything above the Development heading, the part most visitors read.
// The file wraps its prose, so the test reads the slice with whitespace collapsed: a visitor
// sees the same words however the lines are wrapped.
const SPLIT = "\n## Development\n"
const [beforeDevelopment = "", development = ""] = readme.split(SPLIT)
const firstScreen = beforeDevelopment.replace(/\s+/g, " ")

const scriptInstall =
	"curl -fsSL https://github.com/trajectonomics/cli/releases/latest/download/install.sh | sh"
const windowsInstall =
	"irm https://github.com/trajectonomics/cli/releases/latest/download/install.ps1 | iex"
const npmInstall = "npx @trajectonomics/cli@latest --version"
const bunxInstall = "bunx @trajectonomics/cli@latest --version"
const skillCommand = "npx skills add trajectonomics/internal-skills --skill traj -y"
const installCommands = [scriptInstall, windowsInstall, npmInstall, bunxInstall]

const at = (needle: string) => firstScreen.indexOf(needle)

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
		for (const anchor of [bunxInstall, "Which channel", "Uninstall"]) {
			expect(at(anchor)).toBeGreaterThan(-1)
		}
		expect(at(skillCommand)).toBeGreaterThan(at(bunxInstall))
		expect(at(skillCommand)).toBeLessThan(at("Which channel"))
		expect(at(skillCommand)).toBeLessThan(at("Uninstall"))
	})

	it("says the skill step needs Node, which the install scripts do not", () => {
		const step = firstScreen.slice(at(skillCommand), at("Which channel"))
		expect(step).toMatch(/needs Node/)
		expect(step).toMatch(/install scripts do not/)
	})

	it("leaves the Bun-only sentence to Development", () => {
		expect(firstScreen).not.toContain("Bun-only")
		expect(development).toContain("The sources are Bun-only; a released binary needs nothing.")
	})

	it("claims no tax meaning, offers no Homebrew, and links no site yet", () => {
		expect(firstScreen).not.toMatch(/\btax/i)
		expect(firstScreen).not.toMatch(/thailand/i)
		expect(firstScreen).not.toMatch(/financial independence/i)
		expect(firstScreen).not.toMatch(/homebrew/i)
		expect(firstScreen).not.toContain("trajectonomics.com")
	})
})

describe("the README anywhere", () => {
	it("never sends a reader to the unscoped package", () => {
		expect(readme).not.toContain("npx traj")
		expect(readme).not.toContain("bunx traj")
	})
})
