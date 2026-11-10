import { isPlainObject } from "../json"

export type Item = readonly Record<string, unknown>[]

export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = Object.keys(a)
		if (keys.length !== Object.keys(b).length) return false
		return keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
	}
	return false
}

/** Every element is an object with a unique string `id`, so items are matched by identity. */
export function idKeyed(value: readonly unknown[]): value is Item {
	if (value.length === 0) return false
	const ids = new Set<string>()
	for (const item of value) {
		if (!isPlainObject(item)) return false
		const id = item["id"]
		if (typeof id !== "string" || ids.has(id)) return false
		ids.add(id)
	}
	return true
}

export function bothIdKeyed(a: unknown, b: unknown): boolean {
	return Array.isArray(a) && Array.isArray(b) && idKeyed(a) && idKeyed(b)
}

export function idOf(item: Record<string, unknown> | undefined): string {
	return typeof item?.["id"] === "string" ? item["id"] : ""
}

export function mapById(items: Item): Map<string, Record<string, unknown>> {
	return new Map(items.map((item) => [idOf(item), item]))
}

export function commonIds(items: Item, other: Map<string, Record<string, unknown>>): string[] {
	return items.flatMap((item) => (other.has(idOf(item)) ? [idOf(item)] : []))
}
