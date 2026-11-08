import { parseCurrency } from "@trajectonomics/ledger"
import { type AppError, fail, isAppError } from "../errors"
import { guard } from "./guard"

// The core's own toMinorUnits/fromMinorUnits go through `number` division and rounding; nothing
// here does float arithmetic. Digits, sign and scale are handled as text and BigInt.
const DECIMAL = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/
const MAX = BigInt(Number.MAX_SAFE_INTEGER)

/** Minor-unit digits of an ISO 4217 currency, from the same runtime data the core reads. */
function digitsOf(currency: string): number {
	const code = parseCurrency(currency, "currency")
	const options = new Intl.NumberFormat("en", { style: "currency", currency: code })
	return options.resolvedOptions().maximumFractionDigits ?? 2
}

function inexact(path: string, value: string, reason: string): AppError {
	const details = { field: path, value, reason }
	return fail("INVALID_AMOUNT", { path, message: `${path}: ${reason}`, details })
}

function toMinor(value: string, digits: number, path: string): number | AppError {
	const match = DECIMAL.exec(value)
	if (!match) {
		const message = `${path}: "${value}" is not a plain decimal such as 1234.56`
		return fail("invalid_input", { path, message })
	}
	const [, sign = "", whole = "0", fraction = ""] = match
	const kept = fraction.slice(0, digits)
	if (/[^0]/.test(fraction.slice(digits))) {
		return inexact(path, value, `has more than ${digits} decimal places`)
	}
	const magnitude = BigInt(whole + kept.padEnd(digits, "0"))
	if (magnitude > MAX) return inexact(path, value, "exceeds the safe integer range")
	return Number(sign === "-" ? -magnitude : magnitude)
}

/**
 * `"12345.67"` THB → `1234567`. Rejects, never rounds, a value with more decimal places than
 * the currency has (unless they are zeros) or one outside the safe integer range.
 */
export function parseMinorUnits(
	value: string,
	currency: string,
	path = "amount",
): number | AppError {
	return guard(() => toMinor(value, digitsOf(currency), path))
}

/** `1234567` THB → `"12345.67"`: always the currency's full scale, `-` only when negative. */
export function formatMinorUnits(minor: number, currency: string): string {
	if (!Number.isSafeInteger(minor)) throw new RangeError(`${minor} is not a safe integer`)
	const digits = digitsOf(currency)
	const text = Math.abs(minor)
		.toString()
		.padStart(digits + 1, "0")
	const whole = text.slice(0, text.length - digits)
	const sign = minor < 0 ? "-" : ""
	return digits === 0 ? `${sign}${whole}` : `${sign}${whole}.${text.slice(-digits)}`
}

/**
 * THB only in v1 (ADR-0005). The core checks the code first, so an unknown code is still the
 * core's `INVALID_CURRENCY`; any other valid code is `unsupported_currency` at `path`.
 */
export function supportedCurrency(currency: string, path = "currency"): AppError | null {
	const code = guard(() => parseCurrency(currency, path))
	if (isAppError(code)) return code
	if (code === "THB") return null
	return fail("unsupported_currency", {
		path,
		message: `${path}: v1 supports THB only, not ${code}`,
		details: { supported: ["THB"], actual: code },
	})
}
