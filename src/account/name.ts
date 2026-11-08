import type { AppError } from "../errors"
import { fail } from "../errors"

// A canonical UUID shape in any case: ids are read before names (ADR-0018), so a name that looks
// like one would make an account unreachable by the word the user typed.
export const UUID_SHAPED: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function invalidName(): AppError {
	return fail("invalid_input", {
		path: "name",
		message: "name: an account name cannot be shaped like a UUID",
	})
}
