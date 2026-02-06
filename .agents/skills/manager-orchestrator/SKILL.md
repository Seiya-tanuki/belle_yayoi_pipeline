---
name: manager-orchestrator
description: >
  Orchestrate multi-wave delivery across consult and implement lanes.
  Maintains control board state, wave transitions, and blocker escalation.
---

# Manager Orchestrator

## Inputs
- Program board path (`.program/manager/control_board.md`)
- Active context path (`.program/manager/active_context.md`)
- Current wave and track list

## Procedure
1. Read current state from `active_context.md` and `control_board.md`.
2. Determine next required decision:
   - consult launch
   - implement launch
   - gatekeeper rerun
   - acceptance judgment
   - integration readiness
3. Update board status fields and update log.
4. Create/refresh a snapshot in `.program/manager/snapshots/`.
5. Publish concise operator-facing summary.

## Output requirements
1. Explicit state transition line.
2. Next action line.
3. Blocker line if blocked.

## Guardrails
- Keep manager artifacts in `.program/manager/`.
- Do not change requirements in specs.
- Do not modify `main` by default.

