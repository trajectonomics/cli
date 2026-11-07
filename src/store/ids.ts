/**
 * The personal entity's fixed id. Every device seeds the same row, so the one entity that exists
 * today never conflicts in sync. It is passed to the core explicitly: the core's `"default"`
 * entity fallback is never relied on.
 */
export const PERSONAL_ENTITY_ID = "00000000-0000-7000-8000-000000000001"

/** The seeded row's timestamps are fixed too, so the seeded row is identical on every device. */
export const PERSONAL_ENTITY_SEEDED_AT = "1970-01-01T00:00:00.000Z"

/** A client-generated UUIDv7 whose time part is `at`, one reading of the injected clock. */
export function newId(at: Date): string {
	return Bun.randomUUIDv7("hex", at)
}

/** `YYYY-MM-DDTHH:MM:SS.sssZ`. */
export function iso(at: Date): string {
	return at.toISOString()
}
