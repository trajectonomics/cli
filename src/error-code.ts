/** The `code` an OS or SQLite error carries, without trusting its message. */
export function errorCodeOf(error: unknown): string | undefined {
	const code = (error as { code?: unknown } | null)?.code
	return typeof code === "string" ? code : undefined
}
