# T-0000: <Short title>

## Meta
- id: T-0000
- owner_lane: consult -> implement
- risk: low | medium | high
- playbook: tdd-standard | refactor-boundary | migration-safe | research-only | agentos-change
- scope:
  - allow_edit:
    - gas/
    - tests/
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
- web_search: cached_ok | live_needed | disabled
- decision_refs:
  - ADR-0000

## Goal
Describe the outcome in one paragraph.

## Non-goals
List explicit exclusions to prevent scope creep.

## Context / Constraints
- Tech constraints, versions, compatibility requirements.
- Any existing conventions or modules that must be used.
- State whether runtime behavior changes: yes | no.

## Proposed approach (optional)
High-level steps. Keep it concrete.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] ...
2. [AC-2] ...

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V1 | test output, log output, or deterministic proof |
| AC-2 | V2 | test output, log output, or deterministic proof |

## Verification
1. [V1] Command(s) to run, expected outputs, and how to interpret failures.
2. [V2] Any grep/rg proofs, boundary tests, telemetry checks, or golden file checks.

## TDD Evidence Plan (required for `playbook: tdd-standard`)
- Red step (expected fail):
  - Command: ...
  - Expected result: non-zero exit and failure reason tied to target AC IDs.
- Green step (expected pass):
  - Command: ...
  - Expected result: exit 0 and assertions passing.
- If Red evidence is intentionally skipped, add an explicit waiver and reason:
  - Waiver: <none | approved reason>

## Observability Plan (required for runtime behavior changes)
- Signals to capture (logs/metrics/counters/invariants): ...
- Where signals are emitted (module/function/path): ...
- Correlation keys or dimensions for traceability: ...
- Verification mapping (refer to V# steps): ...
- If observability is intentionally skipped (only allowed for non-runtime changes), add:
  - Waiver: <none | approved reason>

## Safety / Rollback
- Potential failure modes and mitigation.
- Rollback steps if applicable.

## Implementation notes (optional)
- File boundaries (what must NOT live where).
- Performance expectations.
