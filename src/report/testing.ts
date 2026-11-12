const GOLDENS = new URL("./fixtures/", import.meta.url)

/** A committed golden's exact bytes, so a test can compare text rather than re-derive a shape. */
export function golden(name: string): Promise<string> {
	return Bun.file(new URL(name, GOLDENS)).text()
}
