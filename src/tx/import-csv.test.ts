import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { IMPORT_HEADER, readImportCsv } from "./import-csv"

const HEADER = "date,from,to,amount,memo,external_ref,project"

function rows(text: string) {
	const parsed = readImportCsv(text)
	if (isAppError(parsed)) throw new Error(JSON.stringify(parsed.body))
	return parsed
}

function failure(text: string) {
	const parsed = readImportCsv(text)
	if (!isAppError(parsed)) throw new Error("expected the reader to fail")
	return parsed.body
}

const row = (cells: readonly string[]): string => cells.join(",")

const LUNCH = ["2026-03-01", "Cash", "Food", "120.50", "Lunch", "kbank:1", "side"]

describe("the import template", () => {
	it("is the same header the constant defines", () => {
		expect(IMPORT_HEADER).toBe(HEADER)
		expect(rows(IMPORT_HEADER)).toEqual([])
	})

	it("reads a plain row into its columns, on the line it is written", () => {
		expect(rows([HEADER, row(LUNCH)].join("\n"))).toEqual([
			{
				line: 2,
				date: "2026-03-01",
				from: "Cash",
				to: "Food",
				amount: "120.50",
				memo: "Lunch",
				external_ref: "kbank:1",
				project: "side",
			},
		])
	})

	it("skips blank and whitespace-only lines and keeps physical line numbers", () => {
		const text = [
			"",
			"   ",
			HEADER,
			"",
			row(LUNCH),
			"\t",
			row(["2026-03-02", "Cash", "Food", "1", "", "kbank:2", ""]),
			"",
		].join("\n")
		expect(rows(text).map((entry) => entry.line)).toEqual([5, 7])
	})

	it("keeps the physical line of the next record when a quoted memo spans lines", () => {
		const text = [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", '"first\nsecond\nthird"', "a", ""]),
			row(LUNCH),
		].join("\n")
		const parsed = rows(text)
		expect(parsed[0]?.memo).toBe("first\nsecond\nthird")
		expect(parsed[1]?.line).toBe(5)
	})
})

describe("CSV syntax", () => {
	it("parses quoted commas, doubled quotes and double-quoted headers", () => {
		const text = [
			`"date","from","to","amount","memo","external_ref","project"`,
			row(["2026-03-01", "Cash", "Food", "1", '"a,b ""quoted"" value"', "ref", ""]),
		].join("\n")
		expect(rows(text)[0]?.memo).toBe('a,b "quoted" value')
	})

	it("trims unquoted cells and keeps quoted ones verbatim", () => {
		const text = [
			HEADER,
			row([" 2026-03-01 ", " Cash", "Food ", " 1 ", '""', " ref ", '"  spaced  "']),
		].join("\n")
		expect(rows(text)[0]).toMatchObject({
			date: "2026-03-01",
			from: "Cash",
			to: "Food",
			amount: "1",
			memo: "",
			external_ref: "ref",
			project: "  spaced  ",
		})
	})

	it("keeps a quoted space distinct from an empty cell", () => {
		const text = [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", '""', "a", '" "']),
			row(["2026-03-02", "Cash", "Food", "1", '" "', "b", ""]),
		].join("\n")
		const parsed = rows(text)
		expect(parsed[0]?.memo).toBe("")
		expect(parsed[0]?.project).toBe(" ")
		expect(parsed[1]?.memo).toBe(" ")
		expect(parsed[1]?.project).toBe("")
	})

	it("reads an only-commas row as seven blank cells, not as a skipped line", () => {
		expect(rows([HEADER, ",,,,,,"].join("\n"))[0]).toMatchObject({
			line: 2,
			date: "",
			from: "",
			to: "",
			amount: "",
			memo: "",
			external_ref: "",
			project: "",
		})
	})

	it("treats LF, CRLF and CR as the same line break, inside and outside quotes", () => {
		const unix = [HEADER, row(["2026-03-01", "Cash", "Food", "1", '"two\nlines"', "a", ""])].join(
			"\n",
		)
		const windows = [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", '"two\nlines"', "a", ""]),
		].join("\r\n")
		const classic = [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", '"two\nlines"', "a", ""]),
		].join("\r")
		expect(rows(windows)).toEqual(rows(unix))
		expect(rows(classic)).toEqual(rows(unix))
	})

	it("strips one leading BOM", () => {
		expect(rows(`\uFEFF${HEADER}\n${row(LUNCH)}`)[0]).toMatchObject({ memo: "Lunch", line: 2 })
	})

	it("accepts a file whose last record has no trailing newline", () => {
		expect(rows(`${HEADER}\n${row(LUNCH)}`)).toHaveLength(1)
		expect(rows(`${HEADER}\n${row(LUNCH)}\n`)).toHaveLength(1)
	})
})

describe("file-level failures", () => {
	it("rejects an empty, whitespace-only or BOM-only file at file", () => {
		for (const text of ["", "   \n\t\n", "\uFEFF", "\uFEFF\r\n"]) {
			expect(failure(text)).toMatchObject({ code: "invalid_input", exitCode: 2, path: "file" })
		}
	})

	it("rejects a wrong header at header, naming what it expected and found", () => {
		for (const text of [
			"from,date,to,amount,memo,external_ref,project",
			"date;from;to;amount;memo;external_ref;project",
			"date,from,to,amount,memo,external_ref",
		]) {
			expect(failure(text)).toMatchObject({
				code: "invalid_input",
				path: "header",
				details: { expected: HEADER, actual: text },
			})
		}
	})

	it("rejects a short or long data row at its line", () => {
		expect(failure([HEADER, "2026-03-01,Cash"].join("\n"))).toMatchObject({
			code: "invalid_input",
			path: "line.2",
			details: { expected: 7, actual: 2 },
		})
		expect(failure([HEADER, `${row(LUNCH)},extra`].join("\n"))).toMatchObject({
			code: "invalid_input",
			path: "line.2",
			details: { expected: 7, actual: 8 },
		})
	})

	it("rejects an unclosed quote at the line the quote opened", () => {
		expect(
			failure(
				[HEADER, "", row(["2026-03-01", "Cash", "Food", "1", '"never closed', "a", ""])].join("\n"),
			),
		).toMatchObject({
			code: "invalid_input",
			path: "line.3",
		})
	})

	it("rejects a quote inside an unquoted field at the record's line", () => {
		expect(failure([HEADER, '2026-03-01,Ca"sh,Food,1,,a,'].join("\n"))).toMatchObject({
			code: "invalid_input",
			path: "line.2",
		})
	})

	it("rejects text after a closing quote", () => {
		expect(
			failure([HEADER, row(["2026-03-01", "Cash", "Food", "1", '"memo"x', "a", ""])].join("\n")),
		).toMatchObject({
			code: "invalid_input",
			path: "line.2",
		})
	})
})
