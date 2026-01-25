
# AGENTS.md (Refactor Phase)
# Contract for Codex/AI-assisted changes in this repository.
# Priority: AI-to-AI precision > human readability.

## 0. Non-negotiables
- Do not change business logic unless the task explicitly says so.
- Prefer mechanical, local refactors with high test coverage over broad rewrites.
- Every change must be backed by:
  (a) grep/rg references, and
  (b) tests (new or existing) that prove behavior is unchanged or improved.
- Never leave the repository in a state where "npm test" fails.

## 1. Workflow (mandatory)
1) Read:
   - docs/refactor/00_invariants.md
   - docs/refactor/01_rules_naming_and_files.md
   - docs/refactor/05_test_and_release_gates.md
2) Create or update a report under refactor/reports/ (ignored by git):
   - Use the templates in refactor/templates/.
   - The report must include file:line anchors for every claim.
3) Propose an actionable plan:
   - Scope boundaries
   - Risk list
   - Test strategy
   - Rollback plan (git tag/commit references)
4) Implement in small commits:
   - Prefer one intent per commit.
   - Commit message prefixes: refactor:, chore:, test:, docs:, fix:
5) Update docs/refactor/ as needed:
   - If a rule changes, capture it in docs/refactor/*.
6) Run tests:
   - npm test must pass.
7) Push and tag only when asked.

## 2. Output rules for Codex instructions
- Instructions MUST be in English.
- Output MUST be a single fenced code block.
- Within the code block:
  - Start with "PHASE 0" and include: "Scope", "Non-goals", "Files", "Steps", "Tests".
  - Use deterministic commands and file paths.
  - If you must decide between options, choose one and explain why (briefly).

## 3. Refactor directory usage
- refactor/** is for large, iterative artifacts:
  - audit reports
  - inventories
  - experimental notes
  - diffs and grep outputs
- Do NOT place production code under refactor/**.
- Do NOT reference refactor/** as a runtime dependency.

## 4. Redaction rules (logs / sample data)
- Do not copy any raw PII into reports.
- When you must include examples, mask:
  - names, addresses, IDs, card/account/member/account numbers
  - any 4+ digit sequences not clearly an amount
- Prefer summaries with stable identifiers (file_id, doc_type, reason codes).

## 5. Decision records
- Draft decisions live in refactor/decisions_draft/.
- Final decisions are promoted to docs/refactor/ (e.g., 04_deprecation_registry.md).
