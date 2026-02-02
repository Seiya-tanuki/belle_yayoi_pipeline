# Taskchain Protocol (v2.1)

Taskchain OS coordinates Belle (planner) and Codex (executor) using file-based tasks.

## 1. Directory conventions

Runtime (git-ignored):
- Incoming zips: `.ai/inbox/`
- TaskSpec: `.ai/taskchain/tasks/`
- TaskState: `.ai/taskchain/state/`
- TaskReport: `.ai/taskchain/reports/`
- Runtime archive (inactive): `.ai/archive/`

AI OS (source of truth):
- Rules: `ai/rules/`
- Contracts: `ai/contracts/`
- Taskchain spec: `ai/taskchain/`

Notes:
- `.ai/archive/` is considered **inactive runtime** and is excluded from Taskchain lint scans.
  It is used to isolate incompatible legacy tasks during upgrades.

## 2. Task identity

### 2.1 Task ID format
- `T0000`, `T0001`, ... (regex: `^T[0-9]{4}$`)

### 2.2 One task = three artifacts
1. TaskSpec: `<ID>.task.md` (immutable)
2. TaskState: `<ID>.state.yml` (mutable)
3. TaskReport: `<ID>.report.md` (generated)

## 3. Status machine

Allowed statuses:
- ready
- in_progress
- blocked
- done_pending_review
- done
- cancelled
- invalid

Rules:
1. Codex may set: ready -> in_progress -> done_pending_review
2. Codex MUST NOT set: done (unless explicit approval command is received)
3. invalid is used when files are malformed or lint fails

## 4. Dependencies (DAG)

1. Dependencies are declared in TaskSpec frontmatter field `depends_on` (array of task IDs).
2. A task is runnable when all dependencies are `done`, unless TaskSpec explicitly allows otherwise.
3. "previous/next" fields are informational only and have no authority.

## 5. Language (English-only OS + Taskchain)

1. AI OS files (`AGENTS.md`, `ai/`, `tools/`) MUST be written in English.
2. Active Taskchain runtime files (`.ai/taskchain/*`) MUST be written in English.
3. TaskSpec and TaskReport frontmatter MUST include:
   - `language: "en"`
   - `language_exceptions: []` (empty unless unavoidable)

## 6. YAML formatting (restricted but standard)

1. YAML indentation uses 2 spaces.
2. Do not use tabs.
3. For list items containing a mapping, continuation keys use **indent + 2** (standard YAML).

## 7. Linting

1. `tools/taskchain/tasklint.py` is the canonical linter.
2. Codex MUST run lint in preflight before executing tasks.
3. Belle SHOULD ensure generated bundles conform to templates and schemas before handoff.

## 8. Bundles (zip)

1. Belle delivers tasks as zip bundles.
2. Human places zip bundles into `.ai/inbox/`.
3. Codex unzips from repo root with `-d .` so paths land correctly.

## 9. Human no-edit rule

Humans do not edit repository files. All changes must be performed by Codex.
The only allowed human operation is placing zip bundles into `.ai/inbox/` and pasting chat triggers.

## 10. Maintenance: archive runtime (chat-trigger allowed)

To recover from incompatible/invalid tasks (e.g., after an OS upgrade),
Codex MAY execute a strictly-scoped archive command that moves:
- `.ai/inbox/` and `.ai/taskchain/` (contents)
into `.ai/archive/<timestamp>/...`, and then recreates empty runtime directories.

Deleting `.ai/archive/` is destructive and MUST be done only via a dedicated TaskSpec with `destructive_ops: true`.
