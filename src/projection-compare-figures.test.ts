import { describe, expect, it } from "bun:test"
import { AS_OF, projection, projectionHome } from "./projection/testing"

type Figure = { age: number; nominal: string | null; real: string | null }

type RunOutSide = {
	fi: { reachable: boolean }
	runOut: { date: string; unmet: string } | null
	netWorth: {
		final: { date: string; nominal: string; real: string }
		atAges: Figure[]
	}
}

type RunOutBody = {
	sides: { a: RunOutSide; b: RunOutSide }
	deltas: { fiMonths: number | null; runOutYears: number | null; atAges: Figure[] }
}

function bodyOf(res: { out: string }): RunOutBody {
	return JSON.parse(res.out) as RunOutBody
}

describe("projection compare figures", () => {
	it("counts run-out years between two plans that both run out", async () => {
		const home = await projectionHome()
		const body = bodyOf(
			await projection(home, [
				"compare",
				"drained-2027",
				"drained-2029",
				"--as-of",
				AS_OF,
				"--horizon",
				"2030-03-30",
			]),
		)
		expect(body.sides.a.runOut?.date).toBe("2027-06-30")
		expect(body.sides.b.runOut?.date).toBe("2029-06-30")
		expect(body.deltas.runOutYears).toBe(2)
		// Neither side reaches FI, so the FI delta has no meaning.
		expect(body.deltas.fiMonths).toBeNull()
	})

	it("has no figure at an age that falls after a side's run-out", async () => {
		const home = await projectionHome()
		const body = bodyOf(
			await projection(home, [
				"compare",
				"drained-2027",
				"base",
				"--as-of",
				AS_OF,
				"--horizon",
				"2030-03-30",
				"--birth-date",
				"1985-06-15",
				"--age",
				"43",
			]),
		)
		// Age 43 is 2028-06-15: after the first side's 2027 run-out, inside the second side's life.
		expect(body.sides.a.netWorth.atAges).toEqual([{ age: 43, nominal: null, real: null }])
		expect(body.sides.b.netWorth.atAges[0]?.nominal).toMatch(/^[0-9]+\.[0-9]{2}$/)
		expect(body.deltas.atAges).toEqual([{ age: 43, nominal: null, real: null }])
	})
})
