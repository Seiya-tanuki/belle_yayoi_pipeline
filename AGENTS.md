# AgentOS (minimal)

This repository uses a **two-lane** workflow for Codex.

- **Consult lane**: research, planning, spec writing, review/judging, and AgentOS self-evolution.
- **Implement lane**: implement strictly from a spec; produce verifiable evidence; stop.

> IMPORTANT language rule:
> - **Chat replies to the user: Japanese.**
> - **Everything else: English** (specs, reports, code comments, commit messages, documentation),
>   except when Japanese is unavoidable (e.g., user-facing JP copy, JP string constants).

## Source of truth
- Implementation MUST treat `.spec/specs/*.md` as the source of truth.
- Do not invent requirements.
- If the spec is ambiguous, missing acceptance criteria, or conflicts with repo reality, stop and request a spec update.

## Pseudo-commands (VS Code / natural language)
Treat the following Japanese phrases as **commands**, not requests:

1. `相談役を起動`
   - Enter **Consult lane** for this thread.
   - Read `.lanes/consult/AGENTS.md` and follow it as the active lane policy.
   - Print a short "Consult lane ready" status summary.

2. `実装役を起動`
   - Implementation must start in a **fresh Codex thread** to minimize context drift.
   - Ask the user to run VS Code command `chatgpt.newChat` (or open a new Codex panel) and then paste the spec path.
   - Once in the new thread, read `.lanes/implement/AGENTS.md` and follow it as the active lane policy.

3. `この内容で仕様書作成`
   - Use `$spec-writer` to draft a new spec in `.spec/specs/`.
   - Then use `$spec-check` to find missing/ambiguous items and update the spec.
   - After the spec is ready, output in chat (Japanese):
     1) a short spec overview + key points
     2) an Implement-lane copy/paste block: `実装役を起動` + the spec relative path

4. `このレポートをジャッジして`
   - Use `$judge` to review diffs + reports against the spec and decide next actions.

5. `AgentOSを進化して`
   - Use `$agentos-evolve` to propose and apply changes to AGENTS/skills/playbooks/rules.

## Windows PowerShell note (encoding)
- If Japanese text appears as mojibake when viewing files in PowerShell, read with UTF-8 explicitly:
  - `Get-Content -Encoding utf8 <path>`

## Safety and risk policy (risk-proportional)
- Never run destructive or irreversible commands without explicit user approval.
  Examples: `rm -rf`, `git reset --hard`, `git clean -fd`, database schema drops, mass deletes.
- Git staging policy:
  - The agent MAY stage changes, including `git add -A` and `git add .`, but SHOULD prefer `git add -p` or explicit paths when practical.
- Git commit policy:
  - The agent MAY commit after a Consult-lane review/judgement marks the implementation as acceptable (e.g., `$judge` => Accept).
  - Commit messages MUST follow Conventional Commits: `<type>(<scope>): <summary>`.
- Git push policy:
  - The agent MUST NOT push by default.
  - The agent MAY push only when explicitly instructed by the user, and only via a two-step flow:
    1) propose + explain the exact commands and what will change (especially deletions)
    2) execute only after the user approves that proposal

## Git naming conventions (adopted)
- Tags:
  - Use annotated tags (`git tag -a`) for important restore points.
  - Prefixes: `checkpoint/`, `archive/`, `release/`, `hotfix/`.
  - Format: `category/<target>-<summary>-YYYYMMDD` (optionally `-HHMM`).
- Branches (work areas): `feat/<slug>-YYYYMMDD`, `fix/<slug>-YYYYMMDD`, `chore/<slug>-YYYYMMDD`, `docs/<slug>-YYYYMMDD`, `spike/<slug>-YYYYMMDD`.

## Where things live (index)
- Specs (authoritative): `.spec/specs/`
- Reports (optional artifacts): `.spec/reports/`
- Decisions / ADRs (AgentOS changes): `.spec/decisions/`
- Skills: `.agents/skills/`
- Playbooks (implementation behavior catalog): `.agents/playbooks/`
- Suggested Codex rules (optional): `codex/rules/default.rules`

## Minimal self-evolution rule
When you change AgentOS (AGENTS/skills/playbooks/rules):
- Record a short ADR in `.spec/decisions/` using the template.
- Prefer moving "long procedures" into skills to keep AGENTS concise.

## Repository defaults (belle_yayoi_pipeline_v0)
- Primary runtime: Google Apps Script under `gas/` (JavaScript; `npm run typecheck` uses `tsc` with `checkJs: true` on `gas/**/*.js`).
- Local regression harness: Node.js tests under `tests/` (vm-evaluates `gas/*.js`).
- Default verification (fast -> full):
  1) `node tests/test_csv_row_regression.js`
  2) `npm run typecheck`
  3) `npm test` (full suite)
- Clasp safety:
  - Never run `clasp deploy`.
  - `clasp push` is dev-only; confirm `.clasp.json` points to the dev scriptId and follow `docs/09_Dev_Environment_Clasp.md`.
- Conventions:
  - Keep comments ASCII only in `gas/*.js` (matches existing codebase constraints).
