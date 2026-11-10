import type { AccountType } from "@trajectonomics/ledger"
import type { AccountRow, EntityRow, PostingRow, TxRow } from "../store"
import { PERSONAL_ENTITY_ID } from "../store"

/** The As-of every report test states, and the day one fixture Transaction posts on. */
export const FIXTURE_AS_OF = "2026-03-31"

/** The fixture's account ids, by name, so a test can point at a row without restating it. */
export const FIXTURE_ACCOUNTS = {
	assets: "0194a000-0009-7000-8000-000000000009",
	bank: "0194a000-0001-7000-8000-000000000001",
	cash: "0194a000-0002-7000-8000-000000000002",
	food: "0194a000-0003-7000-8000-000000000003",
	investment: "0194a000-0004-7000-8000-000000000004",
	loan: "0194a000-0005-7000-8000-000000000005",
	locked: "0194a000-0006-7000-8000-000000000006",
	misc: "0194a000-0007-7000-8000-000000000007",
	oldWallet: "0194a000-0008-7000-8000-000000000008",
	opening: "0194a000-0010-7000-8000-000000000010",
	salary: "0194a000-0011-7000-8000-000000000011",
	savings: "0194a000-0012-7000-8000-000000000012",
} as const

const AT = "2026-01-01T00:00:00.000Z"

export function account(
	id: string,
	name: string,
	type: AccountType,
	parentId: string | null = null,
	archivedAt: string | null = null,
): AccountRow {
	return {
		id,
		entityId: PERSONAL_ENTITY_ID,
		name,
		type,
		currency: "THB",
		parentId,
		archivedAt,
		version: archivedAt === null ? 1 : 2,
		createdAt: AT,
		updatedAt: archivedAt ?? AT,
		deletedAt: null,
	}
}

export function transaction(id: string, date: string, memo: string | null = null): TxRow {
	return {
		id,
		entityId: PERSONAL_ENTITY_ID,
		date,
		memo,
		linkedTo: null,
		externalRef: null,
		version: 1,
		createdAt: `${date}T00:00:00.000Z`,
		updatedAt: `${date}T00:00:00.000Z`,
		correctionKind: null,
	}
}

export function posting(
	txId: string,
	ordinal: number,
	accountId: string,
	amount: number,
	dimensions: Readonly<Record<string, string>> | null = null,
): PostingRow {
	return { txId, ordinal, accountId, amount, currency: "THB", dimensions }
}

export const ENTITY: EntityRow = {
	id: PERSONAL_ENTITY_ID,
	name: "Personal",
	version: 1,
	createdAt: AT,
	updatedAt: AT,
	deletedAt: null,
}
