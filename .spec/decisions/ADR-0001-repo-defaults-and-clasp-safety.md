# ADR-0001: Add repo defaults for verification and clasp safety

## Status
- accepted

## Context
This repository is primarily Google Apps Script code under `gas/` with a Node.js regression harness under `tests/`.
Before this change, AgentOS guidance and the spec template were generic (e.g., `src/`), which caused repeated ambiguity:
- what the fastest reliable verification commands are
- what the default editable paths should be for specs
- how to avoid unsafe clasp operations (deploy/push to non-dev projects)

## Decision
Update AgentOS guidance and rules to encode repo-specific defaults:
- Document default verification commands (fast -> full) and file conventions in `AGENTS.md`.
- Add repo defaults to lane policies so Consult/Implement lanes have a shared baseline.
- Update the spec template to default `scope.allow_edit` to `gas/` + `tests/`.
- Add Codex rule suggestions to forbid `clasp deploy` and prompt on `clasp push`.

Files changed:
- `AGENTS.md`
- `.lanes/consult/AGENTS.md`
- `.lanes/implement/AGENTS.md`
- `.spec/specs/TEMPLATE.md`
- `codex/rules/default.rules`

## Consequences
- Positive: Faster handoffs (clear defaults), safer ops (clasp deploy guarded), less spec drift (correct default paths).
- Negative / risks: Some workflows may need explicit spec overrides (e.g., editing `docs/`), and clasp rules may require extra human confirmation.

## Verification
Smallest reliable checks:
1) Confirm the spec template defaults to `gas/` + `tests/`: open `.spec/specs/TEMPLATE.md`.
2) Confirm lane policies mention the verification commands: open `.lanes/consult/AGENTS.md` and `.lanes/implement/AGENTS.md`.
3) Optional (environment sanity): run `node tests/test_csv_row_regression.js` and `npm run typecheck`.

## Rollback
Revert the edits in the files listed above and delete this ADR file.
