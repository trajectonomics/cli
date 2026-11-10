import { mkdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { type AppError, fail } from "../errors"
import type { ExportFile } from "./files"

function codeOf(error: unknown): string | undefined {
	const code = (error as { code?: unknown } | null)?.code
	return typeof code === "string" ? code : undefined
}

/** Never the OS's own message: a stable code, the path, and whether a partial directory remains. */
function failed(target: string, error: unknown, cleaned: boolean): AppError {
	const code = codeOf(error)
	const hint = cleaned
		? "Nothing was written; the database is unchanged."
		: "A partial directory may remain; remove it before retrying."
	return fail("export_failed", {
		path: "out",
		message: `The export could not be written: ${target}`,
		details: code === undefined ? { path: target } : { path: target, code },
		hint,
	})
}

async function removeQuietly(target: string): Promise<boolean> {
	return rm(target, { recursive: true, force: true }).then(
		() => true,
		() => false,
	)
}

function outputExists(target: string): AppError {
	return fail("output_exists", {
		path: "out",
		message: `The output path already exists: ${target}`,
		details: { path: target },
	})
}

/** The parent may be created recursively; the target itself never is (see below). */
async function makeParent(target: string): Promise<AppError | null> {
	try {
		await mkdir(dirname(target), { recursive: true })
		return null
	} catch (error) {
		// Nothing of ours exists yet, so nothing needs removing.
		return failed(target, error, true)
	}
}

/** A non-recursive `mkdir` is the race-safe existence test: only EEXIST means "already there". */
async function makeTarget(target: string): Promise<AppError | null> {
	try {
		await mkdir(target)
		return null
	} catch (error) {
		if (codeOf(error) === "EEXIST") return outputExists(target)
		return failed(target, error, await removeQuietly(target))
	}
}

/**
 * Writes `files` into a directory created at `out`. The parent is created recursively, then the
 * target with a non-recursive `mkdir`, so an existing path is `output_exists` at exit 5 and a
 * typo can never overwrite an older backup. A failed write removes the directory this run
 * created; `null` means every file was written.
 */
export async function writeExport(
	out: string,
	files: readonly ExportFile[],
): Promise<AppError | null> {
	const target = resolve(out)
	const parent = await makeParent(target)
	if (parent) return parent
	const created = await makeTarget(target)
	if (created) return created
	try {
		for (const file of files) await Bun.write(join(target, file.name), file.contents)
		return null
	} catch (error) {
		return failed(target, error, await removeQuietly(target))
	}
}
