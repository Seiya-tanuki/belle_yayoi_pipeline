---
name: context-ledger-manager
description: >
  Maintain durable external context for long-running programs using
  `.program/manager/` artifacts, snapshots, and recovery checkpoints.
---

# Context Ledger Manager

## Purpose
Prevent drift and recovery failures after context compression or thread restart.

## Core artifacts
- `.program/manager/active_context.md`
- `.program/manager/control_board.md`
- `.program/manager/snapshots/*.md`
- `.program/manager/registry/*.yaml`

## Procedure
1. Before major action, refresh `active_context.md`:
   - current wave
   - open blockers
   - next decision
2. Write checkpoint snapshot at required trigger points.
3. Keep instruction/branch/evidence registries synchronized.
4. On recovery:
   - read latest snapshot
   - read active context
   - read control board
   - confirm restart baseline in chat

## Required snapshot triggers
1. Before and after wave launch decisions
2. After gatekeeper decisions
3. After Accept/Revise judgments
4. Before and after integration merge operations
5. Before push/deploy-adjacent operations

## Guardrails
- Do not rely only on chat history for state.
- Every significant decision must exist in both:
  - control board update log
  - snapshot file

