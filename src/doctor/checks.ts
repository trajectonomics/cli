import type { AppError } from "../errors"
import type { DoctorCheck, DoctorCheckName, DoctorStatus } from "./output"

/** The one skipped sentence every check that needs a date shares. */
export const NO_TRIAL =
	"Skipped: a Trial Balance is stated at a date, so it needs --as-of YYYY-MM-DD."

export function step(name: DoctorCheckName, status: DoctorStatus, detail: string): DoctorCheck {
	return { name, status, detail }
}

/** The envelope of a failed store call as one sentence: its code, path and message. */
export function sentenceOf(error: AppError): string {
	const { code, message, path } = error.body
	return path === undefined ? `${code}: ${message}` : `${code} (${path}): ${message}`
}

/** One sentence shared by every check that could not run because of an earlier failure. */
export function skipped(name: DoctorCheckName, why: string): DoctorCheck {
	return step(name, "skipped", why)
}
