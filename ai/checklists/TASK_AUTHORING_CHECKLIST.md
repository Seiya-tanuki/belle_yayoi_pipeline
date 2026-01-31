# TASK_AUTHORING_CHECKLIST.md (for Belle)

Use this checklist before delivering a task bundle to the human.

## 1. TaskSpec quality
1. Task has a unique ID (`^T[0-9]{4}$`) and matching file names.
2. Goals and Non-goals are explicit.
3. Scope is tight:
   - allow_paths are minimal
   - deny_paths includes `ai/` and `.ai/` unless explicitly needed
4. Acceptance criteria:
   - machine steps are runnable commands (no placeholders)
   - human checks are realistic and specific
5. Authority sources are listed and sufficient (no ambiguous "read docs" only).

## 2. Taskchain correctness
1. `depends_on` is accurate (DAG).
2. `auto_advance_allowed` is false by default.
3. `codex_max_status` is `done_pending_review` unless explicit reasons.

## 3. Bundle integrity
1. Bundle contains:
   - `.ai/taskchain/tasks/<ID>.task.md`
   - `.ai/taskchain/state/<ID>.state.yml`
2. Paths inside zip are correct relative paths (extract to repo root).
3. Timestamps are valid ISO 8601 strings.

## 4. Human no-edit compliance
1. Do not require the human to edit any file.
2. Any approvals are done via Codex chat command, not manual edits.

