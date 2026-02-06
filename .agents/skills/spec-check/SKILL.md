---
name: spec-check
description: >
  Review an implementation spec for missing, ambiguous, or non-testable requirements.
  Focus on correctness and handoff quality; ignore style trivia (indentation, line width).
---

# Spec Check (soft lint)

## Goal
Make a spec safe and executable by Implement lane without slowing work via strict formatting.

## What to check (in order)
1. **Authority and scope**
   - Does the spec clearly state what files may be edited (`scope.allow_edit`) and what is forbidden?
   - Is `.spec/specs/` forbidden for Implement lane?

2. **Missing required sections**
   - Meta, Goal, Non-goals, Acceptance Criteria, Traceability Matrix, Verification, Safety/Rollback.
   - For `playbook: tdd-standard`: TDD Evidence Plan must exist.
   - For runtime behavior changes: Observability Plan must exist (or explicit waiver with reason).

3. **Testability and determinism**
   - Are acceptance criteria phrased so they can be checked by tests or deterministic commands?
   - Does Verification include exact commands and pass/fail interpretation?

4. **Traceability completeness**
   - Does every AC ID map to at least one verification step ID?
   - Are expected evidence artifacts defined for each AC ID?

5. **TDD evidence requirements**
   - For `playbook: tdd-standard`, is Red (expected fail) defined before Green (expected pass)?
   - Is any TDD waiver explicit and justified?

6. **Observability requirements**
   - For runtime behavior changes, are signals, emission points, and verification steps specified?
   - Is any observability waiver explicit and justified?

7. **Ambiguity / under-specification**
   - Identify any requirement that could be interpreted multiple ways.
   - Propose concrete wording changes.

8. **Playbook alignment**
   - If `playbook: tdd-standard`, ensure criteria can be turned into tests.
   - If `refactor-boundary`, ensure boundary proofs exist.
   - If `migration-safe`, ensure rollback and staged plan exist.

9. **Risk proportionality**
   - If `risk: medium/high`, verify Safety/Rollback is meaningful.

## Output format
- Report findings as:
  1. Blocking issues (must fix before implementation)
  2. Non-blocking improvements (nice to have)
- For each blocking issue, propose a concrete spec edit.
- Missing mandatory three-drive items should be treated as blocking by default.
- If asked to apply changes, edit the spec file accordingly.

## Non-goals
- Do NOT enforce indentation, line length, or markdown stylistic rules unless they materially affect clarity.
