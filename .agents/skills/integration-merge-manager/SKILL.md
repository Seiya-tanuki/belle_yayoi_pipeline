---
name: integration-merge-manager
description: >
  Manage pre-main integration of parallel branches. Plans merge order,
  resolves conflicts, and validates integrated behavior before browser testing.
---

# Integration Merge Manager

## Inputs
- Integration branch name
- Included track branch list
- Required verification commands

## Procedure
1. Create/switch integration branch from control point.
2. Merge track branches in planned order.
3. If conflicts occur:
   - identify impacted track intents
   - resolve preserving all required behaviors
   - rerun affected targeted tests
4. Run full regression gate.
5. Write integration readiness summary.

## Output requirements
- Merge/conflict resolution log
- Targeted test evidence
- Full regression evidence
- Final readiness decision:
  - ready for browser validation
  - blocked with reasons

## Guardrails
- Do not merge into `main` without explicit user instruction.
- Do not push by default.
- Keep integration changes on dedicated integration branch.

