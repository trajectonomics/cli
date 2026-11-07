import { fail } from "../errors"
import { isPlainObject } from "../json"
import { abort } from "./guard"

function unsupported(path: string, reason: string): never {
	return abort(fail("invalid_input", { path, message: `${path}: ${reason}` }))
}

function canonicalObject(value: Record<string, unknown>, path: string): string {
	// UTF-16 code unit order, which is what Array.prototype.sort compares and RFC 8785 asks for.
	const keys = Object.keys(value)
		.filter((key) => value[key] !== undefined)
		.sort()
	const members = keys.map(
		(key) => `${JSON.stringify(key)}:${canonicalJson(value[key], `${path}.${key}`)}`,
	)
	return `{${members.join(",")}}`
}

/**
 * RFC 8785 (JCS) canonical JSON. ECMAScript's number and string serialisation is the one JCS
 * specifies, so only object key order and the rejection of non-JSON values are done here. Must
 * run inside `guard`: an unsupported value aborts with `invalid_input` at its path.
 */
export function canonicalJson(value: unknown, path = "document"): string {
	if (value === null || typeof value === "string" || typeof value === "boolean") {
		return JSON.stringify(value)
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? JSON.stringify(value) : unsupported(path, "is not finite")
	}
	if (Array.isArray(value)) {
		return `[${value.map((item, index) => canonicalJson(item, `${path}.${index}`)).join(",")}]`
	}
	if (isPlainObject(value)) return canonicalObject(value, path)
	return unsupported(path, "is not a JSON value")
}

/** The algorithm-tagged hash of canonical text: `jcs1:sha256:<hex>` (ADR-0017). */
export function contentHash(canonical: string): string {
	return `jcs1:sha256:${new Bun.CryptoHasher("sha256").update(canonical).digest("hex")}`
}
