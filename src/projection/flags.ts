import { z } from "zod"
import type { ErrorCode } from "../errors"
import { LEDGER_READ_CODES } from "../store"

/** Every code the projection leaves raise: flags, the Baseline and the engine (ADR-0030). */
export const PROJECTION_ERROR_CODES: readonly ErrorCode[] = [
	"invalid_input",
	"INVALID_DATE",
	"NEGATIVE_AMOUNT",
	"AMOUNT_OVERFLOW",
	"unsupported_currency",
	"not_found",
	"projection_refused",
	...LEDGER_READ_CODES,
]

/** The `--scenario` flag that names the one Scenario a leaf projects. */
export const scenarioFlag: z.ZodString = z.string().describe("The Scenario's exact name or its id.")

/** `--as-of`, the date every projection starts at, which the caller states (ADR-0029). */
export const asOfFlag: z.ZodString = z
	.string()
	.describe("The date the Projection starts at, as YYYY-MM-DD.")

/** `--horizon`, the date every projection ends at. */
export const horizonFlag: z.ZodString = z
	.string()
	.describe("The date the Projection ends at, as YYYY-MM-DD.")

/** `--set`, one transient Override, repeatable and in command-line order (ADR-0024). */
export const setFlag: z.ZodOptional<z.ZodArray<z.ZodString>> = z
	.array(z.string())
	.optional()
	.describe("Replace one existing dotted document path with a JSON value; repeatable.")
