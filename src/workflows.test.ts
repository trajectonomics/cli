import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "./launcher-test-support"

const dir = join(ROOT, ".github/workflows")

type Step = { name?: string; run?: string; uses?: string; with?: Record<string, unknown> }
type Job = {
	uses?: string
	needs?: string | string[]
	permissions?: Record<string, string>
	with?: Record<string, unknown>
	secrets?: string
	steps?: Step[]
	strategy?: { matrix?: { include?: Record<string, string>[] } }
}
type Workflow = {
	on: Record<string, { inputs?: Record<string, unknown>; paths?: string[] } | null>
	permissions?: Record<string, string>
	jobs: Record<string, Job>
}

function load(file: string): Workflow {
	return Bun.YAML.parse(readFileSync(join(dir, file), "utf8")) as Workflow
}

function needs(job: Job): string[] {
	return job.needs === undefined ? [] : Array.isArray(job.needs) ? job.needs : [job.needs]
}

function runs(job: Job): string[] {
	return (job.steps ?? []).map((step) => step.run ?? "")
}

function stepIndex(job: Job, text: string): number {
	const index = (job.steps ?? []).findIndex((step) => step.run?.includes(text))
	expect(index).toBeGreaterThanOrEqual(0)
	return index
}

const RELEASE = load("release.yml")
const BINARIES = load("binaries.yml")
const INSTALLER = load("installer-smoke.yml")

/** Every job whose steps compile the CLI, wherever it lives. */
function compiling(workflow: Workflow): Job[] {
	return Object.values(workflow.jobs).filter((job) =>
		runs(job).some((command) => command.includes("bun build")),
	)
}

describe("every workflow that compiles the CLI", () => {
	it("installs the locked dependencies first, or the compiler cannot resolve them", () => {
		const jobs = [RELEASE, BINARIES, INSTALLER].flatMap(compiling)
		expect(jobs.length).toBeGreaterThan(0)
		for (const job of jobs) {
			expect(runs(job).join("\n")).toContain("bun install --frozen-lockfile")
		}
	})
})

describe("release.yml, the caller npm trusted publishing validates", () => {
	it("publishes only when dispatched, never on a push to main", () => {
		expect(Object.keys(RELEASE.on).sort()).toEqual(["workflow_dispatch"])
		expect(RELEASE.on["workflow_dispatch"]?.inputs).toHaveProperty("bump")
	})

	it("grants the tokens the shared publisher and the release upload need", () => {
		expect(RELEASE.permissions).toEqual({ contents: "write", "id-token": "write" })
	})

	it("is a thin caller: no steps, and the publishing logic stays in cicd", () => {
		const publish = RELEASE.jobs["publish"]
		expect(publish?.uses).toBe("trajectonomics/cicd/.github/workflows/publish.yml@v1")
		expect(publish?.with).toHaveProperty("bump")
		expect(publish?.secrets).toBe("inherit")
		expect(publish?.steps).toBeUndefined()
	})

	it("adds exactly one job, which cannot start before the version exists", () => {
		expect(Object.keys(RELEASE.jobs)).toEqual(["publish", "binaries"])
		const binaries = RELEASE.jobs["binaries"]
		expect(binaries?.uses).toBe("./.github/workflows/binaries.yml")
		expect(needs(binaries!)).toEqual(["publish"])
		expect(binaries?.permissions).toMatchObject({ contents: "write" })
	})
})

describe("binaries.yml, the assets job", () => {
	it("is callable, repairable by dispatch, and proves itself on a pull request", () => {
		expect(BINARIES.on).toHaveProperty("workflow_call")
		expect(BINARIES.on["workflow_dispatch"]?.inputs).toHaveProperty("tag")
		expect(BINARIES.on["pull_request"]?.paths).toContain(".github/workflows/binaries.yml")
	})

	it("reads the whole history and the tags, so the tag the publisher made is visible", () => {
		const resolve = BINARIES.jobs["resolve"]
		const checkout = resolve?.steps?.find((step) => step.uses === "actions/checkout@v4")
		expect(checkout?.with?.["fetch-depth"]).toBe(0)
		expect(runs(resolve!).join("\n")).toContain("git fetch --tags --force origin")
		expect(runs(resolve!).join("\n")).toContain("git rev-list -n 1")
	})

	it("stamps the version from the tag before compiling, because the compiler inlines it", () => {
		const build = BINARIES.jobs["build"]
		expect(stepIndex(build!, "npm version")).toBeLessThan(stepIndex(build!, "bun build"))
		expect(runs(build!).join("\n")).toContain("--outfile assets/traj-windows-x64.exe")
	})

	it("pins the Bun the repo's packageManager names", () => {
		const setup = BINARIES.jobs["build"]?.steps?.find(
			(step) => step.uses === "oven-sh/setup-bun@v2",
		)
		expect(setup?.with?.["bun-version"]).toBe("1.4.4")
	})

	it("builds every x64 asset from the baseline target, so a pre-AVX2 CPU still runs", () => {
		const compile = runs(BINARIES.jobs["build"]!).join("\n")
		for (const asset of ["traj-darwin-x64", "traj-linux-x64", "traj-windows-x64.exe"]) {
			const line = compile.split("\n").find((entry) => entry.includes(`--outfile assets/${asset}`))
			expect(line).toContain("-baseline")
		}
	})

	it("smokes each asset on a runner for its own platform before anything is attached", () => {
		const smoke = BINARIES.jobs["artifact-smoke"]
		expect(needs(smoke!)).toEqual(["resolve", "build"])
		const runners = (smoke?.strategy?.matrix?.include ?? []).map((entry) => entry["runner"])
		expect(runners).toEqual([
			"ubuntu-latest",
			"ubuntu-24.04-arm",
			"macos-15-intel",
			"macos-15",
			"windows-latest",
		])
		expect(runs(smoke!).join("\n")).toContain(".github/smoke.sh")
	})

	it("uploads only after the artifact smoke passed, with only the uploader allowed to write", () => {
		const attach = BINARIES.jobs["attach"]
		expect(needs(attach!)).toEqual(["resolve", "build", "artifact-smoke"])
		for (const job of Object.values(BINARIES.jobs)) {
			if (runs(job).some((command) => command.includes("gh release upload"))) {
				expect(job.permissions).toMatchObject({ contents: "write" })
			}
		}
	})

	it("attaches the checksums in a second upload, never in parallel with the binaries", () => {
		const uploads = runs(BINARIES.jobs["attach"]!).filter((command) =>
			command.includes("gh release upload"),
		)
		expect(uploads).toHaveLength(2)
		expect(uploads[0]).not.toContain("checksums.txt")
		expect(uploads[0]).toContain("install.sh")
		expect(uploads[1]).toContain("checksums.txt")
	})

	it("smokes the channel after the upload, retrying while npm catches up", () => {
		const channel = BINARIES.jobs["channel-smoke"]
		expect(needs(channel!)).toEqual(["resolve", "attach"])
		const command = runs(channel!).join("\n")
		expect(command).toContain("npx --yes")
		expect(command).toContain("SECONDS + 600")
		const runners = (channel?.strategy?.matrix?.include ?? []).map((entry) => entry["runner"])
		expect(runners).toHaveLength(5)
		expect(runs(channel!).join("\n")).toContain("bunx")
	})
})

describe("installer-smoke.yml", () => {
	const installer = INSTALLER

	it("installs on Linux, macOS and Windows from a local server", () => {
		const runners = (installer.jobs["install"]?.strategy?.matrix?.include ?? []).map(
			(entry) => entry["runner"],
		)
		expect(runners).toEqual(["ubuntu-latest", "macos-15", "windows-latest"])
		const command = runs(installer.jobs["install"]!).join("\n")
		expect(command).toContain("install.sh")
		expect(command).toContain("install.ps1")
		expect(command).toContain("TRAJ_DOWNLOAD_BASE_URL")
	})

	it("refuses a bad checksum and leaves no binary behind", () => {
		const command = runs(installer.jobs["install"]!).join("\n")
		expect(command).toContain('"$BASE/bad"')
		expect(command).toContain('[ "$status" -ne 0 ]')
	})
})
