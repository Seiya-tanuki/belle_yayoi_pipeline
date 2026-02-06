# ADR-0006: Remove legacy "Belle" word from AgentOS rule titles

## Status
- accepted

## Context
Some AgentOS rule files still used the legacy word "Belle" in titles/comment headers (a historical prefix).
This word is no longer needed and can be removed without affecting behavior.
Repo identifiers such as `belle_yayoi_pipeline_v0` must remain unchanged to avoid confusion.

## Decision
Remove the word "Belle" only from the following non-functional headings:
- `AGENTS.md` title
- `.agents/README.md` title
- `.agents/COMMANDS.md` title
- `codex/rules/default.rules` top comment header

No other occurrences were changed (including the repository name and historical ADR content).

Files changed:
- `AGENTS.md`
- `.agents/README.md`
- `.agents/COMMANDS.md`
- `codex/rules/default.rules`

## Consequences
- Positive: Cleaner, prefix-free rule headings.
- Negative / risks: None expected (title/comment-only changes).

## Verification
Smallest reliable checks:
1. Confirm the updated headings no longer include "Belle".
2. Confirm the repository name `belle_yayoi_pipeline_v0` remains unchanged in rule files where it appears.

## Rollback
Revert the file edits listed above and delete `ADR-0006-remove-belle-word-from-rule-titles.md`.
