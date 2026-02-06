# Migration Mapping: `temp/refactor_control` -> `.program/manager`

## Objective
Preserve proven operational patterns from the refactor execution artifacts under `temp/` and map them to the manager lane canonical workspace.

## Mapping
1. Program board
- source: `temp/refactor_control/progress_tracker.md`
- target: `.program/manager/control_board.md`
- status: established (structure aligned), historical data can be imported as needed

2. Session prompts
- source: `temp/refactor_control/session_prompts/wave*_*.md`
- target: `.program/manager/waves/wave*/prompts/*.md`
- status: template system established; concrete per-wave migration pending per program

3. Prompt index
- source: `temp/refactor_control/session_prompts/README.md`
- target: `.program/manager/registry/instruction_index.yaml`
- status: seeded and operational

4. Branch/worktree control
- source: ad-hoc updates in `progress_tracker.md` logs
- target: `.program/manager/registry/branch_worktree_map.yaml`
- status: seeded and operational

5. Evidence trace
- source: update log + reports under `.spec/reports/`
- target: `.program/manager/registry/evidence_index.yaml`
- status: seeded and operational

## Operational policy
For new manager-driven programs:
1. use `.program/manager` as canonical
2. keep `temp` artifacts as historical reference only
3. record migration decisions in manager reports/snapshots

