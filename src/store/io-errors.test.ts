import { describe, expect, it } from "bun:test"
import { databaseFailure, directoryFailure } from "./io-errors"

describe("the store's I/O failure mapping", () => {
	it("names a full disk as a typed disk_full", () => {
		const failure = directoryFailure("/home/traj", { code: "ENOSPC" })
		expect(failure?.body).toMatchObject({
			code: "disk_full",
			exitCode: 1,
			details: { path: "/home/traj" },
		})
		expect(failure?.body.hint).toContain("Free space")
		expect(failure?.body.message).toContain("/home/traj")
	})

	it("names a full database disk as a typed disk_full", () => {
		const failure = databaseFailure("/home/traj/traj.db", { code: "SQLITE_FULL" })
		expect(failure?.body).toMatchObject({
			code: "disk_full",
			exitCode: 1,
			details: { path: "/home/traj/traj.db" },
		})
		expect(failure?.body.hint).toContain("Free space")
	})

	it("leaves an error it does not recognise to the internal envelope", () => {
		expect(directoryFailure("/home/traj", { code: "EIO" })).toBeUndefined()
		expect(databaseFailure("/home/traj/traj.db", new Error("boom"))).toBeUndefined()
	})
})
