---
name: integration-merge-manager
description: >
  Manage pre-main integration of parallel branches. Plans merge order,
  resolves conflicts, and validates integrated behavior before browser testing.
---

# Integration Merge Manager (Draft)

## When to use
Use after all tracks in a wave are judged Accept.

## Inputs
1. Integration branch name
2. Included track branch list
3. Required verification command set

## Procedure
1. Create/switch integration branch from designated control point.
2. Merge track branches in planned order.
3. If conflicts occur:
   - identify affected track intents
   - apply merged resolution preserving all required behavior
   - rerun targeted tests for affected tracks
4. Run full regression gate.
5. Produce integration readiness summary for human validation.

## Required output
1. Merge log with conflict/resolution notes.
2. Test evidence:
   - targeted track checks
   - full regression checks
3. Final readiness decision:
   - ready for browser validation
   - not ready (with blockers)

## Safety
1. Do not merge into `main` without explicit user instruction.
2. Do not push by default.
3. Keep integration changes on dedicated branch.

