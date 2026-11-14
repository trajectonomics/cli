import { z } from "zod"

/** A money figure: a decimal string at the currency's own scale (ADR-0009). */
export function moneyField(what: string): z.ZodString {
	return z.string().describe(`${what}, as a decimal string at the currency's own scale.`)
}

/** A date figure: an ISO calendar date. */
export function dateField(what: string): z.ZodString {
	return z.string().describe(`${what}, as YYYY-MM-DD.`)
}
