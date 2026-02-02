# CODEX_TASK_EXECUTION_CONTRACT.md

This contract defines how Codex must execute Taskchain tasks in this repository.

## 1. Inputs & artifacts

### 1.1 Task files (runtime, git-ignored)
- TaskSpec (immutable): `.ai/taskchain/tasks/<ID>.task.md`
- TaskState (mutable): `.ai/taskchain/state/<ID>.state.yml`
- TaskReport (generated): `.ai/taskchain/reports/<ID>.report.md`

### 1.2 Incoming bundles
- Human drops zip bundles into: `.ai/inbox/`
- Codex unzips bundles from repo root:
  - `unzip .ai/inbox/<bundle>.zip -d .`

## 2. Hard Gate (MUST STOP)

Before doing any implementation work, Codex MUST run preflight.

### 2.1 Preflight checks (MUST)
1. Verify required files & dirs per `ai/manifest.yml`.
2. Validate the OS + active Taskchain runtime with:
   - `python tools/taskchain/tasklint.py --all`
   (This includes English-only gates for OS and Taskchain.)
3. Verify dependencies:
   - A task is runnable only if all `depends_on` tasks are `done`,
     unless the TaskSpec explicitly allows otherwise.

### 2.2 If preflight fails (MUST)
1. Do not change product code.
2. Mark the relevant task `blocked` or `invalid` in TaskState (if possible).
3. Write a TaskReport explaining:
   - what failed,
   - evidence (command output summary),
   - what is needed to proceed.

### 2.3 Bootstrap exception
Only the dedicated bootstrap task (typically `T0000`) may run in a repository that does not yet satisfy `ai/manifest.yml`.
All other tasks MUST stop.

## 3. Allowed edits (scope control)

### 3.1 Default allowed edits
Unless the TaskSpec explicitly says otherwise, Codex may edit:
1. Product code under the repository's canonical source root (`src/` or project-specific).
2. Tests under `tests/`.
3. TaskState and TaskReport for the active task.

### 3.2 Default forbidden edits
Codex MUST NOT edit:
1. TaskSpec files (immutable).
2. AI OS files under `ai/` (rules/contracts/schemas/templates),
   unless the TaskSpec explicitly requests such a change.

## 4. Execution procedure (per task)

For each runnable task `<ID>`:

1. **Claim the task**
   - Update TaskState:
     - status: `in_progress`
     - timestamps.started_at: now
2. **Execute TaskSpec**
   - Perform only the actions described in TaskSpec.
3. **Acceptance checks**
   - Run `acceptance.machine` steps as defined in TaskSpec.
4. **Write TaskReport**
   - Create/update `.ai/taskchain/reports/<ID>.report.md`
   - Must follow `ai/contracts/CODEX_REPORT_CONTRACT.md`
5. **Finish**
   - Update TaskState:
     - status: `done_pending_review`
     - timestamps.finished_at: now
6. **Stop**
   - Do not proceed to the next task unless the TaskSpec explicitly allows auto-advance AND dependencies are satisfied.

## 5. Approval & setting `done`

### 5.1 Default rule
Codex MUST NOT set `status=done` by itself.

### 5.2 Approval command format (expected)
Codex may set `done` only after receiving an explicit approval message from the user (copied from Belle),
with a clear header like:

APPROVE TASK: <ID>

### 5.3 Approval procedure (MUST)
When you receive an approval command for `<ID>`:
1. Verify TaskState `<ID>` is `done_pending_review`.
2. Verify TaskReport `<ID>` exists.
3. Update TaskState:
   - status: `done`
   - timestamps.approved_at: now (if field exists; otherwise add it)
4. Re-run lint:
   - `python tools/taskchain/tasklint.py --id <ID>`

If any verification fails, do not set `done`. Write a report explaining why.

## 6. Maintenance outside TaskSpec (strictly limited)

### 6.1 Archive runtime (chat-trigger allowed)
Purpose: recover from invalid/incompatible tasks (e.g., after an OS upgrade) so that lint/preflight can pass again.

When the user sends a strictly-scoped archive command (typically copied from Belle), you MAY:
1. Move **all contents** of:
   - `.ai/inbox/`
   - `.ai/taskchain/`
   into `.ai/archive/<timestamp>/...`
2. Recreate empty runtime directories:
   - `.ai/inbox/`
   - `.ai/taskchain/tasks/`
   - `.ai/taskchain/state/`
   - `.ai/taskchain/reports/`

Constraints:
1. Do NOT modify product code.
2. Do NOT delete files as part of this chat-trigger archive.
3. This maintenance command may be executed even if preflight currently fails (because its goal is to fix preflight).

### 6.2 Purge/delete archive (task-only)
1. Deleting `.ai/archive/` contents is destructive.
2. It MUST be performed only via a dedicated TaskSpec with `destructive_ops: true`.
3. It MUST NOT be performed via ad-hoc chat commands.
