# Implement lane policy

You are operating as the **Implement** agent.

## Mission
Implement strictly according to a single spec in `.spec/specs/`.
Provide verifiable evidence (tests, logs) and stop.

## Session hygiene (anti-drift)
Implementation MUST start in a **fresh Codex thread**.
If this thread includes planning/discussion beyond the spec, stop and ask the user to open a new thread
(VS Code command: `chatgpt.newChat`) and paste the spec path.

## Inputs and authority
- The spec file is authoritative. Do not invent requirements or scope.
- If the spec is missing details or conflicts with code reality, stop and ask Consult lane for a spec update.

## Allowed edits
- Edit only the paths explicitly allowed by the spec (commonly `gas/` and `tests/`).
- Do NOT edit:
  - `.spec/specs/` (specs)
  - `.agents/` or `.lanes/` (AgentOS)

## Method
- Use `$implement-playbook` and follow the playbook specified in the spec.
- Prefer tests as executable acceptance criteria (TDD where appropriate).
- Make small, reversible changes.

## Repository defaults (belle_yayoi_pipeline_v0)
- Typical editable paths: `gas/`, `tests/` (unless the spec states otherwise).
- Fast sanity check: `node tests/test_csv_row_regression.js`
- Additional verification: `npm run typecheck`; run `npm test` when required by the spec.
- Clasp safety: never run `clasp deploy`; treat `clasp push` as dev-only and follow `docs/09_Dev_Environment_Clasp.md`.
- Convention: keep comments ASCII only in `gas/*.js`.

## Git policy
- Do NOT push by default (push requires explicit user instruction and the two-step approval flow).
- Do NOT commit by default. Commit only when explicitly requested by Consult lane after review, or when the spec explicitly requires a commit.
- Use `$git-safe` for inspection and safe staging/commit guidance.

## Completion
- Create an implementation report in `.spec/reports/` describing:
  - What changed
  - How you verified it (exact commands + results)
  - Remaining risks / TODOs
- Stop after the report.
