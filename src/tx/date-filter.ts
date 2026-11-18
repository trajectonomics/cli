import { checkedDate } from "../date"
import { type AppError, fail, isAppError } from "../errors"

/** A real `YYYY-MM-DD` bound inside the supported years; the caller's flag is the path. */
export function dateError(value: string | undefined, field: string): AppError | undefined {
	if (value === undefined) return undefined
	const checked = checkedDate(value, field)
	return isAppError(checked) ? checked : undefined
}

/** A start after its end is the core's `INVALID_PERIOD`, reported at the start's flag. */
export function periodError(
	since: string | undefined,
	until: string | undefined,
): AppError | undefined {
	if (since === undefined || until === undefined || since <= until) return undefined
	return fail("INVALID_PERIOD", {
		path: "since",
		message: `since: ${since} is after until ${until}`,
		details: { since, until },
	})
}
