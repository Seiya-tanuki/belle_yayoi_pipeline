# 10_repo_layout.md (Repository Layout & File Placement Rules)

This is the **single source of truth** for file placement and naming conventions.

## 1. Top-level layout (MUST)
1. `docs/` : Human-facing documentation (decisions, runbooks, onboarding).
2. `ai/`   : AI OS source of truth (rules, contracts, taskchain spec, profiles).
3. `.ai/`  : Runtime (tasks, state, reports, logs, inbox) — git-ignored.
4. `gas/`  : Product code (Google Apps Script).
5. `tests/`: Tests.
6. `tools/`: Helper scripts used by tasks and preflight.
7. `scripts/`, `configs/`, `fixtures/` as needed.
8. Existing top-level dirs in this repo: `configs/`, `fixtures/`, `prompts/`, `reference/`, `templates/`.

## 2. `ai/` subdirectories (source-of-truth)
- `ai/rules/`     : always-on rules (placement, safety, git)
- `ai/contracts/` : execution/reporting contracts for Codex
- `ai/taskchain/` : protocol/schemas/templates
- `ai/profile/`   : how to run this repo (commands, env)
- `ai/specs/`     : specs (optional)
- `ai/plans/`     : execution plans (optional)
- `ai/runbooks/`  : operational runbooks (optional)
- `ai/audit/`     : audit logs (optional)
- `ai/cleanup/`   : cleanup protocols (optional)

## 3. Do not create new top-level directories (MUST)
If you think a new top-level directory is needed:
1. Stop.
2. Propose the change in TaskReport as a follow-up, or request a dedicated task.

## 4. File routing table (MUST)
Place artifacts strictly according to this table.

| Artifact type | Location | Notes |
|---|---|---|
| TaskSpec/State/Report runtime | `.ai/taskchain/` | Must be git-ignored |
| Incoming bundles from human | `.ai/inbox/` | Zip drop zone |
| AI OS rules/contracts/spec | `ai/` | Source of truth |
| Human docs | `docs/` | Archive old docs in `docs/_archive/` |
| Product source code | `gas/` | Avoid code outside `gas/` unless a TaskSpec explicitly allows it |
| Tests | `tests/` | Mirror source layout when possible |
| Tools used by tasks | `tools/` | Prefer cross-platform scripts |
| Logs, scratch, temp | `.ai/logs/`, `.ai/scratch/` | Do not commit |

## 5. Naming (SHOULD)
1. Use lowercase snake_case for file names where practical.
2. Use numeric prefixes only when ordering matters (`docs/INDEX.md` is preferred).

