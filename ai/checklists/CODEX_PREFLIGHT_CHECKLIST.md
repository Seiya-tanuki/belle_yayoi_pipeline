# CODEX_PREFLIGHT_CHECKLIST.md

Before executing any task, you MUST:

1. Confirm you are at repository root.
2. Check required OS files:
   - `cat ai/manifest.yml` (or equivalent)
3. Ensure runtime layer is ignored:
   - `git status --porcelain` must not show `.ai/`
4. Lint:
   - `python tools/taskchain/tasklint.py --all`
5. Dependency check:
   - Do not run a task whose dependencies are not `done`
6. If any check fails:
   - Stop
   - Mark task `blocked`/`invalid`
   - Write TaskReport

