---
name: spec-writer
description: >
  Draft or update an implementation spec in .spec/specs/ using the repo template.
  Use after requirements are clarified (optionally via solution-scout) and before handing off to Implement lane.
---

# Spec Writer

## Purpose
Turn clarified decisions into an **Implement-lane-ready** spec.
The spec must minimize interpretation and provide mechanical verification.

## Inputs
- A short task name / ID (if none, propose one: `T-<date>-<slug>`)
- The agreed requirements and constraints
- The chosen playbook (default: `tdd-standard`)

## Procedure
1. Choose a filename under `.spec/specs/`:
   - Prefer `T-XXXX_<slug>.md` (ASCII slug)
2. Start from `.spec/specs/TEMPLATE.md`.
3. Fill in **Meta**:
   - `risk` (low/medium/high)
   - `playbook` (tdd-standard/refactor-boundary/migration-safe/research-only/agentos-change)
   - `scope.allow_edit` and `scope.forbid_edit`
   - `web_search` policy
   - link relevant ADRs in `decision_refs` if they exist
4. Write Goal / Non-goals:
   - Non-goals should be explicit exclusions to stop scope creep.
5. Write Acceptance Criteria with stable IDs:
   - Use IDs like `AC-1`, `AC-2`.
   - Every criterion should be verifiable via tests or a deterministic check.
6. Write a Traceability Matrix:
   - Map every AC ID to one or more verification step IDs (`V1`, `V2`, ...).
   - Define expected evidence artifacts for each mapping.
7. Write Verification:
   - Exact commands and pass/fail interpretation.
   - Use verification step IDs (`V1`, `V2`, ...).
   - Include boundary and observability checks where applicable.
8. For `playbook: tdd-standard`, write a TDD Evidence Plan:
   - Red command (expected fail) and Green command (expected pass).
   - If Red is skipped, include an explicit approved waiver and reason.
9. For runtime behavior changes, write an Observability Plan:
   - Signals, emission points, correlation keys/dimensions, and verification mapping.
   - If skipped, include an explicit waiver and reason (only for non-runtime changes).
10. Add Safety / Rollback:
   - Especially for `risk: medium/high`.
11. End with Implementation notes only if they reduce ambiguity (file boundaries, invariants).
12. Run `$spec-check` and address any blocking issues.
13. In chat, always output the two handoff artifacts below (Japanese):
   - (1) Spec overview + key points (what to change, what not to change, how to verify)
   - (2) Implement-lane copy/paste block: `実装役を起動` + the spec relative path

## Required chat output (post-spec handoff)
After the spec is written and `$spec-check` passes, output exactly:

1) **Spec overview (Japanese)**, based only on the spec contents:
- Spec path (relative): `.spec/specs/...`
- Meta highlights: id, risk, playbook, scope allow/forbid
- What to implement/change (concrete bullets)
- Non-goals / boundaries (what must not change)
- Verification commands (copy from the spec's Verification section)
- Safety / rollback notes (if any)

2) **Implement-lane copy/paste (Japanese)** in a code block:
```text
実装役を起動
.spec/specs/<SPEC_FILENAME>.md
```

## Quality bar (must pass)
- The Implement agent should be able to proceed with *zero additional clarifying questions*.
- The spec should not rely on conversation history.
- Every AC ID is covered by verification and has expected evidence.
- TDD and observability requirements are explicit (or explicitly waived with reason).

## Output rules
- Specs are written in **English**.
- Keep the spec concise; move long procedures into playbooks or skills.
