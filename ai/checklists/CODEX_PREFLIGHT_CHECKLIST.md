# CODEX_PREFLIGHT_CHECKLIST.md

Before executing any task, you MUST:

1. Confirm you are at repository root.
2. Check required OS files:
   - `cat ai/manifest.yml` (or equivalent)
3. Ensure runtime layer is ignored:
   - `git status --porcelain` must not show `.ai/`
4. Lint (includes English-only gates):
   - `python tools/taskchain/tasklint.py --all`
5. Dependency check:
   - Do not run a task whose dependencies are not `done`
6. If any check fails:
   1) Stop
   2) Mark task `blocked`/`invalid` (if applicable)
   3) Write TaskReport

## Special case: archive runtime (maintenance)
If lint fails due to incompatible/invalid legacy tasks and the user provides a strict archive command,
you may archive `.ai/inbox/` and `.ai/taskchain/` into `.ai/archive/<timestamp>/...` and recreate empty runtime directories.
Deleting `.ai/archive/` is task-only (destructive).
