import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "./launcher-test-support"

const readme = readFileSync(join(ROOT, "README.md"), "utf8")

// The first screen is everything above the Development heading, the part most visitors read.
// Prose wraps and uses inline code, so words are matched with whitespace collapsed and backticks
// removed: a visitor sees the same words however the page is wrapped or marked up. Commands are
// matched against the raw slice, where a broken or wrapped shell line must fail.
const DEVELOPMENT_HEADING = "\n## Development\n"
const [beforeDevelopment = "", development = ""] = readme.split(DEVELOPMENT_HEADING)
const firstScreen = beforeDevelopment.replaceAll("`", "").replace(/\s+/g, " ")

const SCRIPT_INSTALL =
	"curl -fsSL https://github.com/trajectonomics/cli/releases/latest/download/install.sh | sh"
const WINDOWS_INSTALL =
	"irm https://github.com/trajectonomics/cli/releases/latest/download/install.ps1 | iex"
const NPM_INSTALL = "npx @trajectonomics/cli@latest --version"
const BUNX_INSTALL = "bunx @trajectonomics/cli@latest --version"
const SKILL_COMMAND = "npx skills add trajectonomics/internal-skills --skill traj -y"
const INSTALL_COMMANDS = [SCRIPT_INSTALL, WINDOWS_INSTALL, NPM_INSTALL, BUNX_INSTALL]

// The unscoped npm package `traj` belongs to someone else: npx/bunx must never take it bare.
const UNSCOPED_TRAJ = /\b(?:npx|bunx)\s+(?:-\S+\s+)*traj\b/

const at = (needle: string) => beforeDevelopment.indexOf(needle)
const visibleAt = (needle: string | RegExp) =>
	typeof needle === "string" ? firstScreen.indexOf(needle) : firstScreen.search(needle)
const CHANNELS = /which channel/i
const UNINSTALL = /uninstall/i

describe("the README first screen", () => {
	it("ends at the Development heading", () => {
		expect(readme).toContain(DEVELOPMENT_HEADING)
	})

	it("says what traj is, who operates it, and that it never calls a model", () => {
		expect(firstScreen).toContain("free and open source")
		expect(firstScreen).toContain("command line for personal money")
		expect(firstScreen).toMatch(/an AI agent operates it/i)
		expect(firstScreen).toMatch(/never calls a model/i)
	})

	it("keeps the published install commands character for character", () => {
		for (const command of INSTALL_COMMANDS) {
			expect(at(command)).toBeGreaterThan(-1)
		}
	})

	it("adds the outsider skill step after the install commands and before the channels", () => {
		const channels = visibleAt(CHANNELS)
		const uninstall = visibleAt(UNINSTALL)
		for (const anchor of [at(BUNX_INSTALL), visibleAt(SKILL_COMMAND), channels, uninstall]) {
			expect(anchor).toBeGreaterThan(-1)
		}
		expect(visibleAt(SKILL_COMMAND)).toBeGreaterThan(at(BUNX_INSTALL))
		expect(visibleAt(SKILL_COMMAND)).toBeLessThan(channels)
		expect(visibleAt(SKILL_COMMAND)).toBeLessThan(uninstall)
	})

	it("says the skill step needs Node, which the install scripts do not", () => {
		const channels = visibleAt(CHANNELS)
		const skill = visibleAt(SKILL_COMMAND)
		expect(skill).toBeGreaterThan(-1)
		expect(channels).toBeGreaterThan(skill)
		const step = firstScreen.slice(skill, channels)
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
		expect(firstScreen).not.toMatch(/\b(?:homebrew|brew)\b/i)
		expect(firstScreen).not.toContain("trajectonomics.com")
	})
})

describe("the README anywhere", () => {
	it("never sends a reader to the unscoped package", () => {
		expect(readme).not.toMatch(UNSCOPED_TRAJ)
	})
})
