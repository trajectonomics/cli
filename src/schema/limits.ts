/**
 * What this version cannot do, published by `traj schema` so a plan is not built on it (#151). A
 * person asked for each of these and found only a refusal, or nothing at all: `traj schema` is the
 * one page a caller reads before writing anything, so the gaps belong there beside the commands.
 *
 * Each entry states the limit and the way around it, and nothing here promises work that is not in
 * this build. A gap that ships is deleted from this file, never left to rot.
 */
export type NotSupported = {
	/** The thing asked for, in the words a person would use for it. */
	feature: string
	/** What the build does instead, and how to get the effect today. */
	detail: string
}

export const NOT_SUPPORTED: readonly NotSupported[] = [
	{
		feature: "A currency other than THB",
		detail:
			"Every Account is in THB and `traj account add` refuses another code. A Scenario document may state another `currency`, and the projection then refuses it at `scenario.currency`.",
	},
	{
		feature: "Monte Carlo, return shocks and a safest-return stress",
		detail:
			"`traj fi` reports the survival date on one deterministic Projection, and no flag sets a probability threshold, a market-return model or a shock. `@trajectonomics/sim` can model them; this build does not expose them, so a `--method` or `--threshold` flag does not exist.",
	},
	{
		feature: 'A retirement date, as in "retire at 60"',
		detail:
			"No flag states one, and the Scenario document has no `retireAt`: state it by ending the earned Flows at that date (`flows.<id>.end`), which takes an edited document, because `scenario fork --set` replaces a path that already exists and cannot add one.",
	},
]
