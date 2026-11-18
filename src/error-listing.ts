import { type ErrorCode, type ExitCode, RETRYABLE_CODES, registry } from "./registry"

export type RegistryEntry = {
	code: ErrorCode
	exitCode: ExitCode
	message: string
	retryable: boolean
}

/** The whole error registry as `traj schema` prints it, sorted by code. */
export function registryListing(): RegistryEntry[] {
	const codes = (Object.keys(registry) as ErrorCode[]).sort()
	return codes.map((code) => ({
		code,
		exitCode: registry[code].exit,
		message: registry[code].message,
		retryable: RETRYABLE_CODES.includes(code),
	}))
}
