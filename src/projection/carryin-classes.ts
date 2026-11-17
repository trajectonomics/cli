import type { TallyBasis } from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { type JsonRecord, records as objects } from "../scenario/tax/json"
import { isBasis } from "./carryin-view"

/** One class a Levy's own `tally` measures read: the label, and the basis it tallies it under. */
export type CarryInClass = { label: string; basis: TallyBasis }

/** One stated class with its amount in minor units. */
export type StatedTally = { label: string; basis: TallyBasis; amount: number }

/** A class problem, so the caller that found it can name the input path that leads to it. */
export type ClassProblem =
	| { kind: "missing"; missing: CarryInClass[] }
	| { kind: "unknown"; index: number; tally: CarryInClass }
	| { kind: "twice"; index: number; tally: CarryInClass }

export const keyOf = (it: CarryInClass): string => `${it.basis}\u0000${it.label}`

/** The classes a Levy measures, in its own measure order, each pair once. */
export function classesOf(levy: JsonRecord): CarryInClass[] {
	const seen = new Set<string>()
	const classes: CarryInClass[] = []
	for (const measure of objects(levy["measures"])) {
		if (measure["op"] !== "tally") continue
		const label = measure["label"]
		const basis = measure["basis"]
		if (typeof label !== "string" || !isBasis(basis)) continue
		const key = keyOf({ label, basis })
		if (seen.has(key)) continue
		seen.add(key)
		classes.push({ label, basis })
	}
	return classes
}

/**
 * The record's tallies in the Levy's own class order, with `rest` expanded to the classes it does
 * not name. A class the Levy does not read and a class stated twice are refused; a class nobody
 * stated is an error rather than a silent zero (the owner's #114 answer, ADR-0032).
 */
export function withAllClasses(
	stated: readonly StatedTally[],
	classes: readonly CarryInClass[],
	rest: boolean,
	report: (problem: ClassProblem) => AppError,
): StatedTally[] | AppError {
	const known = new Set(classes.map(keyOf))
	const byClass = new Map<string, StatedTally>()
	for (const [index, tally] of stated.entries()) {
		const key = keyOf(tally)
		if (!known.has(key)) return report({ kind: "unknown", index, tally })
		if (byClass.has(key)) return report({ kind: "twice", index, tally })
		byClass.set(key, tally)
	}
	const missing = classes.filter((it) => !byClass.has(keyOf(it)))
	if (missing.length > 0 && !rest) return report({ kind: "missing", missing })
	return classes.map((it) => byClass.get(keyOf(it)) ?? { ...it, amount: 0 })
}
