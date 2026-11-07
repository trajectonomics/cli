import type { AppError } from "../errors"
import { canonicalScenarioDocument, parseMinorUnits } from "../store"
import type { FieldKind } from "./format"
import { invalid } from "./invalid"

type Decode = (value: unknown, path: string, record: Record<string, unknown>) => unknown | AppError

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function text(value: unknown, path: string): unknown | AppError {
	return typeof value === "string" ? value : invalid(path, "must be a string")
}

function time(value: unknown, path: string): unknown | AppError {
	const valid = typeof value === "string" && TIME.test(value)
	if (valid && new Date(value).toISOString() === value) return value
	return invalid(path, "must be a YYYY-MM-DDTHH:MM:SS.sssZ timestamp")
}

function nullable(decode: Decode): Decode {
	return (value, path, record) => (value === null ? null : decode(value, path, record))
}

function int(value: unknown, path: string): unknown | AppError {
	return Number.isSafeInteger(value) ? value : invalid(path, "must be a safe integer")
}

function amount(value: unknown, path: string, record: Record<string, unknown>): unknown {
	const currency = record["currency"]
	if (typeof value !== "string") return invalid(path, "must be a decimal string such as 1234.56")
	if (typeof currency !== "string")
		return invalid(path.replace(/amount$/, "currency"), "must be a string")
	return parseMinorUnits(value, currency, path)
}

function dimensions(value: unknown, path: string): unknown | AppError {
	const isObject = typeof value === "object" && value !== null && !Array.isArray(value)
	if (!isObject) return invalid(path, "must be an object of strings or null")
	const entries = Object.values(value)
	if (entries.length === 0) return invalid(path, "must be null when empty, never {}")
	if (!entries.every((v) => typeof v === "string")) return invalid(path, "values must be strings")
	return value
}

function document(value: unknown, path: string): unknown | AppError {
	return canonicalScenarioDocument(value, path)
}

/** How each field kind is checked and turned back into the store's row value. */
export const DECODERS: Record<FieldKind, Decode> = {
	text,
	"text?": nullable(text),
	time,
	"time?": nullable(time),
	int,
	amount,
	dimensions: nullable(dimensions),
	document,
}
