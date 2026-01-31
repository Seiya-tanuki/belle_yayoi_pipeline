# 60_taskchain.md (Taskchain runtime rules)

## 1. Files
1. TaskSpec: `.ai/taskchain/tasks/<ID>.task.md` (immutable)
2. TaskState: `.ai/taskchain/state/<ID>.state.yml` (mutable)
3. TaskReport: `.ai/taskchain/reports/<ID>.report.md` (generated)

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

