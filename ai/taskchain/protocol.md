# Taskchain Protocol (v2.0)

Taskchain OS coordinates Belle (planner) and Codex (executor) using file-based tasks.

## 1. Directory conventions

Runtime (git-ignored):
- Incoming zips: `.ai/inbox/`
- TaskSpec: `.ai/taskchain/tasks/`
- TaskState: `.ai/taskchain/state/`
- TaskReport: `.ai/taskchain/reports/`
- Optional archive: `.ai/taskchain/archive/`

AI OS (source of truth):
- Rules: `ai/rules/`
- Contracts: `ai/contracts/`
- Taskchain spec: `ai/taskchain/`

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

## 5. TaskSpec frontmatter requirements

TaskSpec files MUST start with YAML frontmatter (`---` blocks).
Required keys are defined in `ai/taskchain/schemas/task.schema.json`.
Use `ai/taskchain/templates/task.template.md` as the base.

## 6. Linting

1. `tools/taskchain/tasklint.py` is the canonical linter.
2. Codex MUST run lint in preflight before executing tasks.
3. Belle SHOULD run lint on generated bundles before handing them off.

## 7. Bundles (zip)

1. Belle delivers tasks as zip bundles.
2. Human places zip bundles into `.ai/inbox/`.
3. Codex unzips from repo root with `-d .` so paths land correctly.

## 8. Human no-edit rule

Humans do not edit repository files. All changes must be performed by Codex.
The only allowed human operation is placing zip bundles into `.ai/inbox/` and pasting chat triggers.

