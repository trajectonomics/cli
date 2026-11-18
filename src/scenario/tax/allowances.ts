/**
 * The fixed allowances a caller states for the taxpayer. They are frozen into the Levy at write
 * time because they depend on the taxpayer, never on a Flow: `@trajectonomics/tax` emits them as
 * one `allowances.fixed` Measure, and the CLI holds no amount of its own.
 */
export type TaxAllowances = {
	parents: number
	disabledCare: number
	socialSecurity: number
	lifeInsurance: number
	healthInsurance: number
	parentHealthInsurance: number
	spouseLifeInsurance: number
	mortgageInterest: number
	donation2x: number
	donation1x: number
}

/** The allowance flags, in the order a result lists them. */
export const ALLOWANCE_FLAGS: readonly (keyof TaxAllowances)[] = [
	"parents",
	"disabledCare",
	"socialSecurity",
	"lifeInsurance",
	"healthInsurance",
	"parentHealthInsurance",
	"spouseLifeInsurance",
	"mortgageInterest",
	"donation2x",
	"donation1x",
]

/** The caller's allowance flags with a `0` for every one it did not state. */
export function allowancesOf(
	flags: Partial<Record<keyof TaxAllowances, number | undefined>>,
): TaxAllowances {
	return Object.fromEntries(
		ALLOWANCE_FLAGS.map((field) => [field, flags[field] ?? 0]),
	) as TaxAllowances
}
