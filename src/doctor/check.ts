import { join, resolve } from "node:path"
import pkg from "../../package.json"
import type { Context } from "../command"
import { DATABASE_FILE, dataDirectory } from "../data-directory"
import { type AppError, isAppError } from "../errors"
import { databaseChecks } from "./database"
import { directoryChecks } from "./directory"
import type { DoctorResult } from "./output"

/** Assembles the whole check: the data directory, then the database it should hold. */
export function doctorOf(ctx: Context, asOf: string | undefined): DoctorResult | AppError {
	const directory = directoryChecks(resolve(dataDirectory(ctx.env)))
	const database = databaseChecks(ctx, join(directory.facts.path, DATABASE_FILE), asOf)
	if (isAppError(database)) return database
	const checks = [...directory.checks, ...database.checks]
	const result: DoctorResult = {
		ok: checks.every((entry) => entry.status !== "fail"),
		cliVersion: pkg.version,
		directory: directory.facts,
		database: database.facts,
		rows: database.rows,
		checks,
	}
	return database.trialBalance === undefined
		? result
		: { ...result, trialBalance: database.trialBalance }
}
