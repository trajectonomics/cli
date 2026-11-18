# An opening balance's sign is the caller's, never inferred from the account

`tx add --opening --amount` is signed: a debt opens negative and an overdrawn asset opens negative, and the CLI never flips a sign to fit the account's type. A positive amount on a liability account is refused at exit 3 with `liability_opening_positive`, naming the account and the amount to type instead, and the dry run refuses it exactly where the real run does.

A liability's Balance is credit-negative (GLOSSARY: Balance, Net worth), so a positive opening states a claim instead of a debt and leaves net worth twice the debt above the truth: a person owing 300,000.00 is told they are rich by 355,000.00 instead of poor by 245,000.00 (cli#149). Normalising the sign was rejected because `ledger-core`'s `openingBalance` states that direction is never inferred, and a silent flip would move money the caller never typed. The rule is the CLI's, not the core's, because the core is handed a signed amount and accepts it: the core's own refusals — a header account, a currency mismatch — still come first, so a caller fixes the shape of the transaction before its meaning.

## Considered options

Inferring the sign from the account's type was rejected for the reason above, and because it would leave no way to open a liability that genuinely holds a debit balance. Refusing every negative amount on an asset was rejected as a false symmetry: an overdrawn asset is a real and common opening state, and it is already the worked example in `tx add`'s help. A `--liability` flag was rejected as a second surface for one rule: it would have to say what `--amount`'s sign already says, and the message tells the caller the sign directly.

## Consequences

`--opening` on a liability with a positive amount now fails where it used to write. A caller who wants a liability holding a debit balance states it with the plain transfer form, where `--to <liability>` credits the account. The code is the CLI's own and sits in ADR-0013's table at exit 3 beside the core's `NEGATIVE_AMOUNT` and `NON_EQUITY_CONTRA`, because it is the same class of rule: the amount's meaning is wrong, not its shape.
