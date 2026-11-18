import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { root } from "./commands"
import { ROOT } from "./launcher-test-support"
import { checkReleaseDocs } from "./release-docs"
import { leavesOf } from "./tree"

const readme = readFileSync(join(ROOT, "README.md"), "utf8")

// The first screen is everything above the Development heading, the part most visitors read.
// Prose wraps and uses inline code, so words are matched with whitespace collapsed and backticks
// removed: a visitor sees the same words however the page is wrapped or marked up. Commands are
// matched against the raw slice, where a broken or wrapped shell line must fail.
const DEVELOPMENT_HEADING = "\n## Development\n"
const [beforeDevelopment = "", development = ""] = readme.split(DEVELOPMENT_HEADING)
const firstScreen = beforeDevelopment.replaceAll("`", "").replace(/\s+/g, " ")
const prose = (text: string) => text.replaceAll("`", "").replace(/\s+/g, " ").trim()
const SCRIPT_INSTALL =
	"curl -fsSL https://github.com/trajectonomics/cli/releases/latest/download/install.sh | sh"
const WINDOWS_INSTALL =
	"irm https://github.com/trajectonomics/cli/releases/latest/download/install.ps1 | iex"
const NPM_INSTALL = "npx @trajectonomics/cli@latest --version"
const BUNX_INSTALL = "bunx @trajectonomics/cli@latest --version"
// Both Skills publish from `trajectonomics/skills` (skills ADR-0003). `trajectonomics/internal-skills`
// keeps only the Skills an internal session runs, so an install line that names it gives a customer
// no `traj` once the internal copy is retired, and one that drops `--skill traj` would add an
// internal session's Skills to their repository (cli#152).
const SKILL_SOURCE = "trajectonomics/skills"
const SETUP_SKILL_COMMAND = `npx skills add ${SKILL_SOURCE} --skill traj-onboarding -y`
const OPERATOR_SKILL_COMMAND = `npx skills add ${SKILL_SOURCE} --skill traj -y`
const INSTALL_COMMANDS = [SCRIPT_INSTALL, WINDOWS_INSTALL, NPM_INSTALL, BUNX_INSTALL]

// The one visible line that says which release ships a section's commands (ADR-0034).
const FUTURE_HEADING = "\n## Reading the future\n"
const RELEASE_MARKER = "> **Ships in 0.2.0.**"
const [, afterFuture = ""] = readme.split(FUTURE_HEADING)
const futureSection = afterFuture.split("\n## ")[0] ?? ""

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

	it("names the setup skill first and the operator skill second, above the channels", () => {
		const channels = visibleAt(CHANNELS)
		const uninstall = visibleAt(UNINSTALL)
		// Each command is one line of the raw slice, so a broken or wrapped shell line fails here.
		for (const command of [...INSTALL_COMMANDS, SETUP_SKILL_COMMAND, OPERATOR_SKILL_COMMAND]) {
			expect(at(command)).toBeGreaterThan(-1)
		}
		expect(channels).toBeGreaterThan(-1)
		expect(uninstall).toBeGreaterThan(-1)
		expect(at(SETUP_SKILL_COMMAND)).toBeGreaterThan(at(BUNX_INSTALL))
		expect(at(OPERATOR_SKILL_COMMAND)).toBeGreaterThan(at(SETUP_SKILL_COMMAND))
		expect(visibleAt(SETUP_SKILL_COMMAND)).toBeLessThan(channels)
		expect(visibleAt(OPERATOR_SKILL_COMMAND)).toBeLessThan(channels)
		expect(visibleAt(OPERATOR_SKILL_COMMAND)).toBeLessThan(uninstall)
	})

	it("gives each skill command one sentence of its own", () => {
		const setupStep = firstScreen.slice(
			visibleAt(SETUP_SKILL_COMMAND),
			visibleAt(OPERATOR_SKILL_COMMAND),
		)
		const operatorStep = firstScreen.slice(visibleAt(OPERATOR_SKILL_COMMAND), visibleAt(CHANNELS))
		expect(setupStep).toMatch(/asks about your situation and goal/i)
		expect(setupStep).toMatch(/installs the traj operating skill from trajectonomics\/skills/i)
		expect(operatorStep).toMatch(/already set up/i)
		expect(firstScreen).not.toMatch(/adds only the traj skill/i)
	})

	it("installs both Skills from the repository that publishes them", () => {
		const sources = [...readme.matchAll(/npx skills add (\S+) --skill/g)].map(
			(match) => match[1] ?? "",
		)
		expect(sources).toEqual([SKILL_SOURCE, SKILL_SOURCE])
		expect(firstScreen).not.toContain("trajectonomics/internal-skills")
	})

	it("says the skill step needs Node, which the install scripts do not", () => {
		const channels = visibleAt(CHANNELS)
		const skill = visibleAt(SETUP_SKILL_COMMAND)
		expect(skill).toBeGreaterThan(-1)
		expect(channels).toBeGreaterThan(skill)
		const step = firstScreen.slice(skill, channels)
		expect(step).toMatch(/\bneeds? Node\b/)
		expect(step).toMatch(/install scripts do not/)
	})

	it("leaves the Bun-only sentence to Development", () => {
		expect(firstScreen).not.toContain("Bun-only")
		expect(development).toContain("The sources are Bun-only; a released binary needs nothing.")
	})

	it("claims no tax meaning and offers no Homebrew", () => {
		expect(firstScreen).not.toMatch(/\btax/i)
		expect(firstScreen).not.toMatch(/thailand/i)
		expect(firstScreen).not.toMatch(/financial independence/i)
		expect(firstScreen).not.toMatch(/\b(?:homebrew|brew)\b/i)
	})

	it("links the landing page and the docs page, and no other site host", () => {
		// A trajectonomics.com link is allowed only for the landing page and the docs page.
		const siteUrls = ["https://trajectonomics.com/", "https://trajectonomics.com/docs/"]
		const linked = beforeDevelopment.match(/https?:\/\/trajectonomics\.com[^\s)\]]*/g) ?? []
		expect(linked.length).toBeGreaterThan(0)
		for (const url of linked) {
			expect(siteUrls).toContain(url)
		}
		for (const url of siteUrls) {
			expect(linked).toContain(url)
		}
		expect(firstScreen).not.toMatch(/workers\.dev/i)
	})
})

// The install page is where a person hands their bank history to an agent, so it names the
// ledger beside the download cache and the command that takes a lossless copy (cli#143).
const LEDGER_PATH = "~/.traj/traj.db"
const EXPORT_COMMAND = "traj export --format jsonl --out backup"

describe("the README says where the ledger lives", () => {
	it("names the ledger in the data directory, and TRAJ_HOME when it is set", () => {
		expect(firstScreen).toContain(`keeps the ledger in ${LEDGER_PATH}`)
		expect(firstScreen).toContain("traj.db inside TRAJ_HOME")
		expect(firstScreen).toContain("the same path on Linux, macOS and Windows")
	})

	it("says the bin cache is disposable and the data directory is not", () => {
		expect(firstScreen).toContain("disposable bin/ download cache")
		expect(firstScreen).toContain("deleting the data directory deletes the ledger")
	})

	it("names the lossless copy after the uninstall step, so the passage explains the directory", () => {
		// `uninstall` mentions the cache first; the ledger path is what disambiguates it.
		const uninstall = visibleAt(UNINSTALL)
		expect(at(EXPORT_COMMAND)).toBeGreaterThan(-1)
		expect(visibleAt(LEDGER_PATH)).toBeGreaterThan(uninstall)
		expect(visibleAt(EXPORT_COMMAND)).toBeGreaterThan(uninstall)
	})

	it("says --out must not exist yet and that JSONL is the only lossless format", () => {
		expect(firstScreen).toContain("must not exist yet")
		expect(firstScreen).toContain("JSONL is the only lossless export format")
	})
})

describe("the README's release marker", () => {
	it("opens the section with the release that ships its commands, before any prose", () => {
		expect(readme).toContain(FUTURE_HEADING)
		const visible = futureSection.split("\n").filter((line) => line.trim() !== "")
		expect(visible[0]).toBe(RELEASE_MARKER)
	})

	it("says what today's release lacks and where those commands arrive", () => {
		const marker = prose(
			futureSection
				.split("\n")
				.filter((line) => line.startsWith(">"))
				.map((line) => line.replace(/^>\s?/, ""))
				.join(" "),
		)
		expect(marker).toContain(
			"The release you installed has no projection, fi or scenario tax: they are on main and reach the install channels with 0.2.0.",
		)
	})

	it("still describes the commands that marker covers", () => {
		for (const command of [
			"traj projection run",
			"traj projection compare",
			"traj fi",
			"traj scenario tax",
		]) {
			expect(futureSection).toContain(command)
		}
	})
})

describe("the README anywhere", () => {
	it("never sends a reader to the unscoped package", () => {
		expect(readme).not.toMatch(UNSCOPED_TRAJ)
	})

	it("names only commands this tree has, or marks the section that ships them", () => {
		// The offline half of the release-docs check (ADR-0034): no network, so the tree's own
		// paths stand in for a release and the freshness rule stays with the weekly run.
		const known = leavesOf(root).map(({ path }) => path.join(" "))
		expect(checkReleaseDocs({ readme, known, notes: [] })).toEqual([])
	})
})
