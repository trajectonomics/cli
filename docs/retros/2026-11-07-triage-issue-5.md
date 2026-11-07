# Retro: triage and grilling #5

2026-11-07. One triage session: #5 from `needs-triage` to `ready-for-agent`, sixteen decisions in two grilling rounds, two model consults (Claude Sonnet 5.5, Gemini 4 Argon), ADR-0016 and ADR-0017, two glossary entries, a brief on #5 and a child issue (#22).

Findings are ordered by severity. Each one names evidence from the session and the cheapest fix.

## 1. Two tickets speak a binary name that does not exist

**Evidence:** #8 says `excited inspect …`, `excited export …`; #13 says `excited tx import --template`. `package.json`'s `bin` is `traj`, ADR-0014 says `~/.traj/traj.db`, and every shipped command is `traj …`.

**Why it matters:** both are Phase 1/2 work that will be handed to an AFK agent, and a brief is written by reading the body. An agent that follows #8 literally builds `excited`, and no guardrail in the repo can see the mistake because the string lives in the tracker, not the tree.

**Fix:** during each ticket's triage, rewrite the verb name in its body or scope list. Two edits, now.

## 2. Nothing binds the glossary and ADRs to the command tree

**Evidence:** this session wrote `Archive — _Avoid_: close` while #6 already specifies `account close`. The contradiction survived one review round and surfaced only when a reviewer read the glossary against the issue body. It was fixed by hand, twice.

**Why it matters:** it is a mechanical class of error — a word in a doc colliding with a name in code — and the repo already runs a test suite on every PR. Prose in `AGENTS.md` ("don't let the glossary contradict commands") would be a no-op; the check is cheap and total.

**Fix:** a test beside the existing suite, no new tooling:
- every file in `docs/adr/` matches `NNNN-kebab-title.md`, numbers unique, no gaps
- no `_Avoid_:` term in `GLOSSARY.md` equals a leaf name or a group name in the command tree, case-insensitively

Roughly forty lines, and it would have failed on the first attempt this session.

## 3. Choosing a model is a blind guess that costs a user turn

**Evidence:** `antigravity/claude-sonnet-5-5` → `You have reached your Antigravity quota for this period.` Then `pi/gemini-4-argon` → `MODEL_NOT_IN_PLAN`. Then `antigravity/gemini-4-argon` → worked. Two failed dispatches, two interruptions, one round trip each.

**Why it matters:** the harness already knows a model's plan and quota state; the agent only learns it by spending a delegated run and a question to the human. The human then has to make a choice that was never theirs to make.

**Fix, in the harness rather than the repo:** report per-model availability in the capability listing, or have a dispatch return the provider that can serve the model. Until then: when a model is named, probe the enabled providers that list it before presenting a choice.

## 4. `AGENTS.md` names one core out of three

**Evidence:** rule 5 sends tax math to `@trajectonomics/tax` and says nothing about `ledger-core` or `sim-core`. This session found `ledger-core` on npm by curling the registry, and only then learned its `Account` has no name and its postings have no id — the two facts that reshaped the design.

**Why it matters:** the always-loaded file is the right place for a pointer, and this is a pointer-shaped gap. ADR-0006 holds the reasoning; rule 5 should hold the address.

**Fix:** amend rule 5 to name all three cores, their publish state (`ledger-core` on npm at an alpha, `sim-core` not published, `tax-core` not yet a dependency), and point at ADR-0006. One line.

## 5. A visual is sent twice, byte for byte

**Evidence:** the schema diagram is ~7 KB of HTML. It had to be written to a file, then passed as a literal string to `html_preview`, then passed again to `html_render`. Two iterations is ~21 KB of identical payload.

**Why it matters:** token economy on the largest single artifact of the session. The duplication grows with every redraw, which is exactly when iteration matters.

**Fix, in the harness:** accept a path or an artifact id, so a page is written once and referenced by name afterwards.

## 6. Triage stops for authorisation the invocation already gave

**Evidence:** the invocation was "triage #5 and if it still here let $grill-with-docs" — the next step was authorised in the request. Step 2 says recommend and wait for direction, so the first reply had to either stop for a redundant confirmation or merge the recommendation with round 1, which is what happened.

**Why it matters:** it is one wasted turn every time a maintainer hands over a multi-step intent, and the workaround is invisible in the skill.

**Fix, upstream:** "If the invocation already authorises the next step, deliver the recommendation and that step's first round in one message." `.agents/skills/` is vendored by `skills-lock.json`, so this belongs in the source repo, not in a local edit.

## 7. A fresh worktree cannot run the repo's check

**Evidence:** the first `bun run check` in this worktree exited 127 — `biome: command not found` — because the checkout arrived without `node_modules`. After `bun install --frozen-lockfile` the same command passed in under a second.

**Why it matters:** `bun run check` is the repo's definition of done, and an agent that trusts the first failure sees a broken repo rather than an uninstalled one.

**Fix:** the worktree setup step runs `bun install --frozen-lockfile`, so the guardrail is live on the first invocation.

## Checked and clean

- **The guardrail is wired.** `.github/workflows/ci.yml` runs `bun run check` — lint, typecheck, tests, compiled build — on every PR and on `main`, then smokes `./dist/traj --version`. `pr-title.yml` enforces a conventional subject because squash titles drive the version. Nothing to add here.
- **The navigation docs did their job.** `docs/agents/domain.md` correctly sent the session to `GLOSSARY.md` and `docs/adr/`; `docs/agents/issue-tracker.md` supplied the exact `gh` recipes for labels, sub-issues and blocked-by, all of which worked first try.
- **No `CODING_STANDARDS.md`, no reviewer agent.** Standards currently sit in `AGENTS.md`, which is the implementation side. That is the wrong side once a reviewer exists, but nothing exists to split yet — a watch item, not a change.
