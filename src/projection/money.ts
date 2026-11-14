import { z } from "zod"
import { formatMinorUnits } from "../store"

/** A money figure: a decimal string at the currency's own scale (ADR-0009). */
export function moneyField(what: string): z.ZodString {
	return z.string().describe(`${what}, as a decimal string at the currency's own scale.`)
}

/** A date figure: an ISO calendar date. */
export function dateField(what: string): z.ZodString {
	return z.string().describe(`${what}, as YYYY-MM-DD.`)
}

/** The currency's own money formatter, so every figure of one result renders the same way. */
export function moneyOf(currency: string): (minor: number) => string {
	return (minor: number) => formatMinorUnits(minor, currency)
}
