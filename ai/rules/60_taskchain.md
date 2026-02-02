# 60_taskchain.md (Taskchain runtime rules)

## 1. Files
1. TaskSpec: `.ai/taskchain/tasks/<ID>.task.md` (immutable)
2. TaskState: `.ai/taskchain/state/<ID>.state.yml` (mutable)
3. TaskReport: `.ai/taskchain/reports/<ID>.report.md` (generated)
4. Runtime archive (inactive): `.ai/archive/`

## 2. Status machine
Allowed statuses:
- ready
- in_progress
- blocked
- done_pending_review
- done
- cancelled
- invalid

## 3. Done gating
1. Codex MUST NOT set `done` on its own.
2. Codex may set `done` only after an explicit approval command is received.

## 4. Dependencies
1. Dependencies are declared in TaskSpec `depends_on`.
2. A task is runnable only when all dependencies are `done` (unless TaskSpec explicitly allows otherwise).

## 5. English-only Taskchain
1. All active Taskchain files under `.ai/taskchain/` MUST be written in English.
2. TaskSpec and TaskReport MUST declare:
   - `language: "en"`
   - `language_exceptions: []` (empty by default)
3. Non-English content in active Taskchain files is a Hard Gate failure.

## 6. Runtime archive & purge

### 6.1 Archive (chat-trigger allowed)
To recover from incompatible/invalid tasks (e.g., after an OS upgrade),
Codex MAY execute a strictly-scoped **archive command** (typically copied from Belle) that:
1. Moves all contents of `.ai/inbox/` and `.ai/taskchain/` into `.ai/archive/<timestamp>/...`
2. Recreates empty runtime directories under `.ai/` (`inbox/`, `taskchain/tasks/`, `taskchain/state/`, `taskchain/reports/`)

This is NOT a TaskSpec-based operation (it is a limited maintenance command).

### 6.2 Purge/delete (task-only)
1. Deleting `.ai/archive/` contents is destructive.
2. It MUST be performed only via a dedicated TaskSpec with:
   - `destructive_ops: true`
   - scope.allow_paths explicitly including `.ai/archive/`
3. Purge MUST NOT be performed via ad-hoc chat commands.
