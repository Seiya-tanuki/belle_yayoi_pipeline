# 00_base.md (Base Rules)

These rules apply to all tasks unless the TaskSpec explicitly overrides them.

## 1. Evidence first
1. Do not guess. If information is missing, stop and report.
2. Prefer quoting file paths and small excerpts over vague descriptions.
3. When you claim something works, provide evidence (tests, commands, logs).

## 2. Scope discipline
1. Do only what the TaskSpec asks.
2. If you see an improvement opportunity outside scope, note it in the report as a follow-up.

## 3. Human no-edit rule
1. The human user does not edit repository files.
2. The only allowed human action is placing a zip bundle into `.ai/inbox/` and pasting your chat triggers.
3. Therefore:
   - Do not ask the human to edit files.
   - Any repository changes must be done by you (Codex).

## 4. Safety
1. For destructive operations (deletes/moves/rewrites):
   - Require explicit permission in the TaskSpec.
   - Prefer dry-run.
   - Keep backups where feasible.

## 5. Output encoding
1. Repository text files should be UTF-8 unless a spec says otherwise.
2. If output requires another encoding (e.g., CP932), scope it to generated artifacts only.

