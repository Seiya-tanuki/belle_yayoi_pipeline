# ai/INDEX.md (AI OS Index)

This `ai/` directory is the **source of truth for AI-driven development** in this repository.

## Read order (MUST)
1. `ai/manifest.yml` (required files & runtime paths)
2. `ai/rules/00_base.md`
3. `ai/rules/10_repo_layout.md`
4. `ai/contracts/AUTHORITY.md`
5. `ai/contracts/CODEX_TASK_EXECUTION_CONTRACT.md`
6. `ai/contracts/CODEX_REPORT_CONTRACT.md`
7. `ai/taskchain/protocol.md`
8. `ai/taskchain/templates/` (TaskSpec/State/Report templates)
9. `ai/profile/PROJECT_PROFILE.md` (project-specific commands)
10. `ai/kb/` (design constraints & decisions, if present)

## Directory roles (source-of-truth)
- `ai/rules/`      : always-on rules (placement, safety, testing, git)
- `ai/contracts/`  : execution/reporting contracts for Codex
- `ai/taskchain/`  : taskchain protocol/schemas/templates
- `ai/profile/`    : how to run this repo (commands, env)
- `ai/specs/`      : specs (if used)
- `ai/plans/`      : execution plans (if used)
- `ai/runbooks/`   : operational procedures (if used)
- `ai/audit/`      : audit logs / changelog (optional)
- `ai/cleanup/`    : cleanup protocols (optional)

## Runtime (git-ignored)
- `.ai/` is the runtime layer.
- Taskchain runtime paths:
  - `.ai/taskchain/tasks/`
  - `.ai/taskchain/state/`
  - `.ai/taskchain/reports/`
- Incoming zips:
  - `.ai/inbox/`

## If something is unclear
Stop and report. Do not guess. Create a snapshot/report task if needed.
