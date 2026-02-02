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
2. The only allowed human action is placing a zip bundle into `.ai/inbox/` and pasting chat triggers.
3. Therefore:
   1) Do not ask the human to edit files.
   2) Any repository changes must be done by you (Codex).

## 4. Language policy (English-first)
1. AI OS files (`AGENTS.md`, `ai/`, `tools/`) MUST be written in English.
2. Active Taskchain runtime files (`.ai/taskchain/*`) MUST be written in English.
3. If a task needs non-English output (e.g., Japanese UI strings), keep the TaskSpec itself in English.
   - Use `language_exceptions` in the TaskSpec frontmatter only when unavoidable.
4. If language requirements are unclear, stop and ask Belle for clarification via a task, not via ad-hoc chat rules.

## 5. Safety
1. For destructive operations (deletes/moves/rewrites):
   1) Require explicit permission in the TaskSpec.
   2) Prefer dry-run.
   3) Keep backups where feasible.

## 6. Output encoding
1. Repository text files should be UTF-8 unless a spec says otherwise.
2. If output requires another encoding (e.g., CP932), scope it to generated artifacts only.

## 7. Formatting discipline (YAML)
1. YAML uses 2-space indentation.
2. Do not use tabs.
3. For list items containing a mapping, continuation keys use **indent + 2** (standard YAML).
