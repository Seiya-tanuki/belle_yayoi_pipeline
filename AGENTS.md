# AGENTS.md (Entry Point for Codex)

This repository is operated using **Taskchain OS (Belle Pack v2.1)**.

## 1. Non-negotiables (MUST)
1. **Do exactly what the active TaskSpec says. Do nothing else.**
2. Chat messages are *triggers* only. The source of truth is:
   1) `ai/` (rules + contracts), and
   2) Taskchain runtime files (`.ai/taskchain/...`).
3. The human user **does not edit repository files**.
   - The only allowed human action is placing a zip file into `.ai/inbox/`.
4. **English-only OS + Taskchain**:
   - `AGENTS.md`, all files under `ai/` and `tools/`, and all active Taskchain files under `.ai/taskchain/` MUST be written in English.
   - If lint reports non-English content, you MUST stop (no implementation work).
5. **Hard Gate**:
   - If required files are missing, lint fails, dependencies are not satisfied, or authority is unclear, you MUST stop and write a report (no implementation work).

## 2. Required reads (MUST)
1. `ai/INDEX.md`
2. `ai/rules/10_repo_layout.md`
3. `ai/contracts/AUTHORITY.md`
4. `ai/contracts/CODEX_TASK_EXECUTION_CONTRACT.md`
5. `ai/contracts/CODEX_REPORT_CONTRACT.md`
6. `ai/taskchain/protocol.md`

## 3. Runtime directories
- Incoming zips (from the human): `.ai/inbox/` (create if missing)
- Taskchain runtime (active):
  - TaskSpec: `.ai/taskchain/tasks/`
  - TaskState: `.ai/taskchain/state/`
  - TaskReport: `.ai/taskchain/reports/`
- Runtime archive (inactive / ignored by lint):
  - `.ai/archive/`

> `.ai/` is git-ignored by design. It must NOT pollute `git status --porcelain`.

## 4. Standard workflow
1. **Unzip** (from repo root):
   - `unzip .ai/inbox/<bundle>.zip -d .`
2. **Preflight**:
   - `python tools/taskchain/tasklint.py --all`
3. **Execute runnable tasks**
   - You may use: `python tools/taskchain/next_task.py`
4. For each task:
   1) Update TaskState to `in_progress`
   2) Execute the TaskSpec
   3) Create TaskReport
   4) Update TaskState to `done_pending_review`
   5) STOP and wait for an explicit approval command for `done`

## 5. Approval (done)
You MUST NOT set `status=done` by yourself.
Only set `done` after you receive an explicit approval command from the user (copied from Belle), and after verifying:
1. TaskReport exists for that task ID.
2. TaskState is currently `done_pending_review`.

## 6. Maintenance: archive runtime (chat-trigger allowed)

When the user sends a **strictly-scoped archive command** (typically copied from Belle),
you MAY perform runtime archival even if preflight currently fails.

Allowed operation:
1. Move **all contents** of:
   - `.ai/inbox/`
   - `.ai/taskchain/`
   into `.ai/archive/<timestamp>/...`
2. Recreate empty runtime directories:
   - `.ai/inbox/`
   - `.ai/taskchain/tasks/`
   - `.ai/taskchain/state/`
   - `.ai/taskchain/reports/`

Forbidden:
- Do NOT delete files as part of the chat-trigger archive.
- Deleting `.ai/archive/` is a destructive operation and MUST be done only via a dedicated TaskSpec with `destructive_ops: true`.
