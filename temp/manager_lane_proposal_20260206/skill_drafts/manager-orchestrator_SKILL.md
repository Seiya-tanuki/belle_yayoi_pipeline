---
name: manager-orchestrator
description: >
  Orchestrate multi-wave delivery across consult and implement lanes.
  Maintains control board state, wave transitions, and blocker escalation.
---

# Manager Orchestrator (Draft)

## When to use
Use when a project has:
1. more than one active track
2. parallel agent threads
3. explicit wave gates

## Inputs
1. Control board path
2. Active wave tracks
3. Spec/report references

## Procedure
1. Load current control board.
2. Confirm wave state and blockers.
3. Determine next operational action:
   - prepare prompts
   - review completion
   - close wave
   - escalate blocker
4. Update board status and update log.
5. Publish concise operator summary.

## Required output
1. Status transition record.
2. Next action list.
3. Blocker line if progress is blocked.

## Safety
1. Do not invent requirements outside spec.
2. Do not modify `main` by default.
3. Keep all decisions auditable in board logs.

