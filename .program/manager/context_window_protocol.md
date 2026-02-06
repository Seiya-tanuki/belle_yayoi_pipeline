# External Context Window Protocol

## Objective
Maintain high recovery reliability for long-running multi-wave operations.

## Canonical state files
1. `control_board.md`
2. `active_context.md`
3. latest file in `snapshots/`

## Snapshot cadence
Create snapshot files at:
1. wave start decision
2. wave launch decision
3. every gatekeeper decision
4. every per-track Accept/Revise judgment
5. pre/post integration merge batch
6. pre push/deploy-adjacent operation

## Minimum snapshot payload
1. timestamp
2. current wave and track statuses
3. blockers
4. next decision
5. branch/worktree map summary
6. evidence pointers

## Recovery procedure
After context compression or new thread start:
1. read latest snapshot
2. read `active_context.md`
3. read `control_board.md`
4. confirm:
   - current wave
   - blockers
   - next action
5. write a recovery checkpoint to `snapshots/`

## Path-based instruction operation
To reduce chat payload size, prompts are executed by file path.

Recommended format:
1. lane command
2. `指示書を実行 <path>`

The instruction path must be recorded in:
- `registry/instruction_index.yaml`

