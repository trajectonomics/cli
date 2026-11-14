import { describe, expect, it } from "bun:test"
import simPackage from "@trajectonomics/sim/package.json"
import { goldenTextIn, recordGoldenIn } from "./golden-test-support"
import { AS_OF, baseFlags, HORIZON, projection, projectionHome } from "./projection/testing"
import { type RunBody, runBody, tableOf } from "./projection-run-support"
import { capture } from "./test-support"

const GOLDENS = new URL("./projection/fixtures/", import.meta.url)

/** The engine version is checked first, so a bump fails before any byte comparison. */
async function expectGoldenEngineVersion(): Promise<void> {
	let text: string
	try {
		text = await goldenTextIn(GOLDENS, "run.json")
	} catch {
		// No golden yet: the test that records it creates one.
		return
	}
	if (runBody({ out: text, code: 0, err: "" }).engine.version !== simPackage.version) {
		throw new Error(
			`The golden was produced with @trajectonomics/sim ${JSON.parse(text).engine.version}, but ${simPackage.version} is installed. Re-baseline it deliberately: TRAJ_UPDATE_GOLDEN=1 bun test src/projection-run.test.ts`,
		)
	}
}

describe("projection run", () => {
	it("matches the committed golden, value for value", async () => {
		await expectGoldenEngineVersion()
		const home = await projectionHome()
		const res = await projection(home, ["run", ...baseFlags()])
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		const body = runBody(res)
		// The Scenario's id is minted when the row is written, so the golden records a token.
		const stable: RunBody = { ...body, scenario: { ...body.scenario, id: "the-scenario-id" } }
		await recordGoldenIn(GOLDENS, "run.json", stable)
		// Compared as values, not bytes: the repository's formatter owns the golden's layout.
		expect(JSON.parse(await goldenTextIn(GOLDENS, "run.json"))).toEqual(stable)
	})

	it("echoes the As-of, the engine, the Scenario and the tax status (ADR-0030)", async () => {
		const home = await projectionHome()
		const body = runBody(await projection(home, ["run", ...baseFlags()]))
		expect(body.asOf).toBe(AS_OF)
		expect(body.horizon).toBe(HORIZON)
		expect(body.currency).toBe("THB")
		expect(body.engine).toEqual({ package: "@trajectonomics/sim", version: simPackage.version })
		expect(body.scenario).toMatchObject({
			name: "base",
			contentHash: body.scenario.effectiveContentHash,
		})
		expect(body.overrides).toEqual([])
		expect(body.tax).toBe("not_applied")
		expect(body.notes[0]).toContain("No tax is applied")
		expect(body.runsOut).toBeNull()
	})

	it("rolls up the year and adds the monthly rows only with --monthly", async () => {
		const home = await projectionHome()
		const body = runBody(await projection(home, ["run", ...baseFlags()]))
		expect(body.tables.map((table) => table.name)).toEqual(["annual"])
		const annual = tableOf(body, "annual")
		expect(annual.count).toBe(1)
		expect(annual.rows[0]).toMatchObject({
			index: 0,
			from: AS_OF,
			to: HORIZON,
			openingNetWorth: "953449.51",
			closingNetWorth: "1615523.96",
			partial: false,
		})
		const withMonths = runBody(await projection(home, ["run", ...baseFlags(), "--monthly"]))
		expect(withMonths.tables.map((table) => table.name)).toEqual(["annual", "monthly"])
		const monthly = tableOf(withMonths, "monthly")
		expect(monthly.count).toBe(13)
		expect(monthly.rows[0]?.date).toBe(AS_OF)
		expect(Object.keys(monthly.rows[0] ?? {}).sort()).toEqual([
			"accessibleNetWorth",
			"date",
			"netWorth",
			"realAccessibleNetWorth",
			"realNetWorth",
		])
	})

	it("takes the real figure from the row on the roll-up's end or the next day", async () => {
		const home = await projectionHome()
		// A longer horizon makes the first roll-up end on the day before the anniversary, which has
		// no monthly row: the figure then comes from the anniversary's row and says so.
		const long = runBody(
			await projection(home, [
				"run",
				"--scenario",
				"base",
				"--as-of",
				AS_OF,
				"--horizon",
				"2028-03-30",
				"--monthly",
			]),
		)
		const annual = tableOf(long, "annual")
		const rows = tableOf(long, "monthly").rows
		expect(annual.rows[0]?.to).toBe("2027-03-30")
		expect(rows.map((row) => row.date)).not.toContain("2027-03-30")
		const realFigure = annual.rows[0]?.realNetWorth
		if (typeof realFigure !== "object" || realFigure === null) {
			throw new Error("the roll-up has no real figure")
		}
		expect(realFigure.date).toBe("2027-03-31")
		expect(realFigure.amount).toBe(
			rows.find((row) => row.date === "2027-03-31")?.realNetWorth as string,
		)
		// The roll-up's own closing figure is nominal, and never the real one.
		expect(annual.rows[0]?.closingNetWorth).not.toBe(annual.rows[0]?.realNetWorth)
	})

	it("gives identical bytes twice, in JSON and in the human format", async () => {
		const home = await projectionHome()
		const once = await projection(home, ["run", ...baseFlags(), "--monthly"])
		const twice = await projection(home, ["run", ...baseFlags(), "--monthly"])
		expect(twice.out).toBe(once.out)
		const flags = ["projection", "run", ...baseFlags(), "--monthly"]
		const humanOnce = await capture(flags, { TRAJ_HOME: home })
		const humanTwice = await capture(flags, { TRAJ_HOME: home })
		expect(humanOnce.code).toBe(0)
		expect(humanTwice.out).toBe(humanOnce.out)
		expect(humanOnce.out).toContain("annual (1 row)")
		expect(humanOnce.out).toContain("monthly (13 rows)")
		expect(humanOnce.out).toContain("No tax is applied")
	})

	it("applies --set transiently and echoes it with the effective hash", async () => {
		const home = await projectionHome()
		const plain = runBody(await projection(home, ["run", ...baseFlags()]))
		const whatIf = runBody(
			await projection(home, ["run", ...baseFlags(), "--set", "flows.salary.amount=9000000"]),
		)
		expect(whatIf.overrides).toEqual([{ path: "flows.salary.amount", value: 9000000 }])
		expect(whatIf.scenario.contentHash).toBe(plain.scenario.contentHash)
		expect(whatIf.scenario.effectiveContentHash).not.toBe(plain.scenario.contentHash)
		expect(tableOf(whatIf, "annual").rows[0]?.income).toBe("1080000.00")
		// Nothing was written: the stored Scenario is unchanged.
		const after = runBody(await projection(home, ["run", ...baseFlags()]))
		expect(after.scenario.effectiveContentHash).toBe(plain.scenario.contentHash)
	})

	it("describes its input and result in `traj schema`", async () => {
		const res = await capture(["schema", "projection", "run", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("projection run")
		expect(data.positionals).toEqual([])
		expect(Object.keys(data.input.properties).sort()).toEqual([
			"asOf",
			"horizon",
			"monthly",
			"scenario",
			"set",
		])
		expect(data.input.required.sort()).toEqual(["asOf", "horizon", "scenario"])
		expect(data.output.properties.tables.type).toBe("array")
		for (const code of ["invalid_input", "not_found", "projection_refused", "INVALID_DATE"]) {
			expect(data.errorCodes).toContain(code)
		}
	})
})
