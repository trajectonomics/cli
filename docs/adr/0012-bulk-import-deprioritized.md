# Bulk import is deprioritized and accepts one CSV template

Parsing arbitrary bank exports is a large, brittle surface. When bulk `tx import` is built, it accepts exactly one CSV template that the client LLM fills in from whatever source it has. Imports are idempotent via `external_ref`.

The import contract is recorded in ADR-0025.
