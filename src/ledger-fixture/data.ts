import type { RestoreRows } from "../store"
import { account, ENTITY, FIXTURE_ACCOUNTS, FIXTURE_AS_OF, posting, transaction } from "./rows"

/*
 * The one fixture Ledger the report tests share. Its rows carry literal ids and timestamps,
 * because `newId` mints a random UUIDv7 on every call even under a fixed clock (ADR-0019); it is
 * loaded through `Store.restore`, which writes every column verbatim.
 *
 * Chart: the `Assets` header over two children (`Bank`, `Cash`), `Investment`, `Locked`,
 * `Savings` (no postings), an archived `Old wallet` that keeps money, the `Loan` liability,
 * `Salary` income, `Food` and `Misc` (no postings) expenses, and `Opening` equity.
 *
 * Balances at 2026-03-31, in THB minor units (satang):
 *
 *   Bank       52854950   25000000 + 20000000 - 125050 + 5000000 + 3000000 - 20000
 *   Cash       49990001   50000000 - 9999
 *   Food         155049   125050 + 20000 + 9999 (the last on the As-of itself)
 *   Investment 10000000
 *   Loan      -20000000
 *   Locked      2000000
 *   Misc              0   no postings
 *   Old wallet   500000
 *   Opening   -87500000
 *   Salary     -8000000
 *   Savings           0   no postings
 *
 *   net worth   95344951   assets 115344951 - liabilities 20000000
 *   trial       115500000  debits and credits alike
 *   P&L         7844951    income 8000000 - expenses 155049
 *
 * The project dimension is `venture`: the February salary and the March food carry it, the March
 * salary and the other food do not. The 2026-04-01 food posting is after the As-of, so no report
 * at that date counts it.
 */

export const FIXTURE_ROWS: RestoreRows = {
	entity: [ENTITY],
	account: [
		account(FIXTURE_ACCOUNTS.assets, "Assets", "asset"),
		account(FIXTURE_ACCOUNTS.bank, "Bank", "asset", FIXTURE_ACCOUNTS.assets),
		account(FIXTURE_ACCOUNTS.cash, "Cash", "asset", FIXTURE_ACCOUNTS.assets),
		account(FIXTURE_ACCOUNTS.food, "Food", "expense"),
		account(FIXTURE_ACCOUNTS.investment, "Investment", "asset"),
		account(FIXTURE_ACCOUNTS.loan, "Loan", "liability"),
		account(FIXTURE_ACCOUNTS.locked, "Locked", "asset"),
		account(FIXTURE_ACCOUNTS.misc, "Misc", "expense"),
		account(FIXTURE_ACCOUNTS.oldWallet, "Old wallet", "asset", null, "2026-01-20T09:30:00.000Z"),
		account(FIXTURE_ACCOUNTS.opening, "Opening", "equity"),
		account(FIXTURE_ACCOUNTS.salary, "Salary", "income"),
		account(FIXTURE_ACCOUNTS.savings, "Savings", "asset"),
	],
	tx: [
		transaction("0194b000-0001-7000-8000-000000000001", "2026-01-01", "Opening balances"),
		transaction("0194b000-0002-7000-8000-000000000002", "2026-02-01", "Loan drawdown"),
		transaction("0194b000-0003-7000-8000-000000000003", "2026-02-15"),
		transaction("0194b000-0004-7000-8000-000000000004", "2026-02-25", "Venture wages"),
		transaction("0194b000-0005-7000-8000-000000000005", "2026-03-10"),
		transaction("0194b000-0006-7000-8000-000000000006", "2026-03-20"),
		transaction("0194b000-0007-7000-8000-000000000007", FIXTURE_AS_OF),
		transaction("0194b000-0008-7000-8000-000000000008", "2026-04-01"),
	],
	posting: [
		// Opening balances: one balanced compound entry across every non-zero balance-sheet Account.
		posting("0194b000-0001-7000-8000-000000000001", 0, FIXTURE_ACCOUNTS.cash, 50000000),
		posting("0194b000-0001-7000-8000-000000000001", 1, FIXTURE_ACCOUNTS.bank, 25000000),
		posting("0194b000-0001-7000-8000-000000000001", 2, FIXTURE_ACCOUNTS.investment, 10000000),
		posting("0194b000-0001-7000-8000-000000000001", 3, FIXTURE_ACCOUNTS.locked, 2000000),
		posting("0194b000-0001-7000-8000-000000000001", 4, FIXTURE_ACCOUNTS.oldWallet, 500000),
		posting("0194b000-0001-7000-8000-000000000001", 5, FIXTURE_ACCOUNTS.opening, -87500000),
		// The loan is a liability, so its raw Balance is negative.
		posting("0194b000-0002-7000-8000-000000000002", 0, FIXTURE_ACCOUNTS.bank, 20000000),
		posting("0194b000-0002-7000-8000-000000000002", 1, FIXTURE_ACCOUNTS.loan, -20000000),
		posting("0194b000-0003-7000-8000-000000000003", 0, FIXTURE_ACCOUNTS.food, 125050),
		posting("0194b000-0003-7000-8000-000000000003", 1, FIXTURE_ACCOUNTS.bank, -125050),
		// The tagged pair: both sides carry the project, so the P&L filter sees both.
		posting("0194b000-0004-7000-8000-000000000004", 0, FIXTURE_ACCOUNTS.bank, 5000000, {
			project: "venture",
		}),
		posting("0194b000-0004-7000-8000-000000000004", 1, FIXTURE_ACCOUNTS.salary, -5000000, {
			project: "venture",
		}),
		posting("0194b000-0005-7000-8000-000000000005", 0, FIXTURE_ACCOUNTS.bank, 3000000),
		posting("0194b000-0005-7000-8000-000000000005", 1, FIXTURE_ACCOUNTS.salary, -3000000),
		posting("0194b000-0006-7000-8000-000000000006", 0, FIXTURE_ACCOUNTS.food, 20000, {
			project: "venture",
		}),
		posting("0194b000-0006-7000-8000-000000000006", 1, FIXTURE_ACCOUNTS.bank, -20000, {
			project: "venture",
		}),
		posting("0194b000-0007-7000-8000-000000000007", 0, FIXTURE_ACCOUNTS.food, 9999),
		posting("0194b000-0007-7000-8000-000000000007", 1, FIXTURE_ACCOUNTS.cash, -9999),
		posting("0194b000-0008-7000-8000-000000000008", 0, FIXTURE_ACCOUNTS.food, 1111),
		posting("0194b000-0008-7000-8000-000000000008", 1, FIXTURE_ACCOUNTS.cash, -1111),
	],
	scenario: [],
}
