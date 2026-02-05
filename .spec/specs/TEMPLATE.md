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

## Proposed approach (optional)
High-level steps. Keep it concrete.

## Acceptance Criteria (testable)
1. ...
2. ...

## Verification
1. Command(s) to run, expected outputs, and how to interpret failures.
2. Any grep/rg proofs, boundary tests, or golden file checks.

## Safety / Rollback
- Potential failure modes and mitigation.
- Rollback steps if applicable.

## Implementation notes (optional)
- File boundaries (what must NOT live where).
- Performance expectations.
