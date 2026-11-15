/** A JSON object a stored document is made of, without asserting the engine's types. */
export type JsonRecord = Record<string, unknown>

export function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** The object entries of a JSON array field, in document order; anything else is empty. */
export function records(value: unknown): JsonRecord[] {
	return Array.isArray(value) ? value.filter(isRecord) : []
}
