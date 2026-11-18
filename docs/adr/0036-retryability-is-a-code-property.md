# Retryability is a property of the error code, not a seventh exit class

Exit 5 holds both failures worth retrying (`database_busy`) and failures that never are
(`output_exists`, `account_name_taken`, `external_ref_conflict`), so an agent that reads only the
exit status cannot tell whether to run the same command again. The registry therefore records
`retryable` per code, and both `traj help` at the root and `traj schema` print which codes carry
it. The exit classes stay the six of ADR-0010 and ADR-0013.

## Considered options

A seventh exit class for retryable failures was rejected. The class is wire format: ADR-0013
records that reclassifying a code is a break, and a caller that branches on the class would have
to learn a new number for a distinction the string `code` already names. The conflict class also
comes from the ledger core's own semantics, not from how long a writer happened to wait, so
splitting it by retryability would make one rule span two classes.

Leaving the fact only in `details.retryable` was rejected too. It is not discoverable before a
failure happens, and `traj schema` is the one place a mode-less caller learns the contract.

## Consequences

A new code declares retryability in `RETRYABLE_CODES` beside the registry; absent from that list
means permanent, so a forgotten entry fails closed. The root help lists the retryable codes and
says every other failure is permanent. Codes keep exactly one exit class, and a consumer may
branch on `code` for the retry decision or read the `retryable` field from `traj schema`.
