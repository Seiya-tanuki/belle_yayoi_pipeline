# Manager External Context Workspace

## Purpose
`.program/manager/` is the durable external context window for Manager lane.

This workspace is used to:
1. persist long-running program state
2. survive context compression and thread restarts
3. coordinate parallel tracks with auditable logs

## Structure
- `control_board.md`: program source of truth
- `active_context.md`: compact restart context
- `context_window_protocol.md`: mandatory checkpoint/recovery rules
- `registry/`: instruction, branch/worktree, and evidence indexes
- `snapshots/`: chronological checkpoints
- `waves/`: per-wave prompt packs and decisions
- `integration/`: merge plans and readiness reports
- `tools/`: validation and quality-gate scripts
- `reports/`: self-analysis and comparison reports
- `migrations/`: mapping from legacy manager artifacts
- `templates/`: reusable manager templates

## Migration note
Previous temporary control artifacts may still exist under `temp/`.
Manager lane should use `.program/manager/` as the canonical workspace going forward.
