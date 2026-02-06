# ADR-0009: Integrate Manager lane as optional with minimal rule changes

## Status
- proposed

## Context
Manager lane was bootstrapped, but root command/rule files still described a two-lane-only model.
We need minimal updates so that:
1. Manager lane is available for cross-track orchestration.
2. Small fixes still work with Consult + Implement only.
3. Manager lane has explicit commit and branch-operation authority for orchestration, while push/mainline safety remains unchanged.

## Decision
Apply minimal updates to existing rule files:
1. `AGENTS.md`
   - Change workflow statement to default two-lane + optional manager lane.
   - Add pseudo-command `管理役を起動`.
   - Add pseudo-command `指示書を実行 <path>`.
   - Add manager lane commit authority for orchestration/integration.
   - Add manager lane branch/worktree authority (non-main default only).
   - Keep push/mainline safety restrictions.
   - Add `.program/manager/` to index.
2. `.agents/COMMANDS.md`
   - Add `管理役を起動`.
   - Add `指示書を実行 <path>`.
   - Keep existing consult/implement artifact commands intact.
3. `.lanes/manager/AGENTS.md`
   - Clarify branch-operation/commit authority.
   - Clarify ability to include branch/commit steps in manager-issued instructions.

## Consequences
- Positive effects
  - Manager lane becomes operationally visible with minimal friction.
  - Two-lane flow remains default for small tasks.
  - Parallel orchestration authority is explicit and auditable.
- Negative effects / risks
  - Slightly more command surface area in root docs.
  - Requires disciplined lane choice by user/operator.

## Verification
1. Root AGENTS contains:
   - default two-lane + optional manager statement
   - commands `管理役を起動` and `指示書を実行 <path>`
2. `.agents/COMMANDS.md` contains the same two commands.
3. Manager lane policy contains explicit branch/commit authority.
4. Push/mainline safety remains explicitly restricted.

## Rollback
1. Revert updated files:
   - `AGENTS.md`
   - `.agents/COMMANDS.md`
   - `.lanes/manager/AGENTS.md`
2. Remove this ADR file.
3. Keep manager-lane bootstrap assets for later reintroduction if needed.

