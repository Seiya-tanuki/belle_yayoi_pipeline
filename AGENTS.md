# AgentOS (minimal)

This repository uses a **default two-lane** workflow for Codex, with an optional Manager lane for cross-track orchestration.

- **Consult lane**: research, planning, spec writing, review/judging, and AgentOS self-evolution.
- **Implement lane**: implement strictly from a spec; produce verifiable evidence; stop.
- **Manager lane (optional)**: coordinate multi-track parallel execution, gate decisions, and integration management.

> IMPORTANT language rule:
> - **Chat replies to the user: Japanese.**
> - **Everything else: English** (specs, reports, code comments, commit messages, documentation),
>   except when Japanese is unavoidable (e.g., user-facing JP copy, JP string constants).

## Source of truth
- Implementation MUST treat `.spec/specs/*.md` as the source of truth.
- Do not invent requirements.
- If the spec is ambiguous, missing acceptance criteria, or conflicts with repo reality, stop and request a spec update.

## Three-drive execution gates
- Spec-driven gate:
  - Specs MUST define testable acceptance criteria with stable IDs (for example, `AC-1`).
  - Specs MUST include a traceability mapping from each acceptance criterion to deterministic verification steps.
- Test-driven gate:
  - For `playbook: tdd-standard`, specs MUST define a Red/Green evidence plan.
  - Implementation MUST capture both Red (expected fail) and Green (expected pass) evidence in the report.
- Data-driven gate:
  - Specs for runtime behavior changes MUST include an observability plan (signals, where emitted, and verification).
  - If observability is intentionally skipped (for example comment-only change), specs MUST include an explicit waiver reason.
- If any required gate is missing, stop and request a spec update in Consult lane.

## Pseudo-commands (VS Code / natural language)
Treat the following Japanese phrases as **commands**, not requests:

1. `相談役を起動`
   - Enter **Consult lane** for this thread.
   - Read `.lanes/consult/AGENTS.md` and follow it as the active lane policy.
   - Print a short "Consult lane ready" status summary.

2. `実装役を起動`
   - Enter **Implement lane** for this thread.
   - Read `.lanes/implement/AGENTS.md` and follow it as the active lane policy.
   - Provide the target spec path and execute implementation from that spec.

3. `管理役を起動`
   - Enter **Manager lane** for this thread.
   - Read `.lanes/manager/AGENTS.md` and follow it as the active lane policy.
   - Use this lane only when project-wide cross-track orchestration is needed.
   - Small fixes may continue with Consult + Implement only (Manager is optional).

4. `この内容で仕様書作成`
   - Use `$spec-writer` to draft a new spec in `.spec/specs/`.
   - Then use `$spec-check` to find missing/ambiguous items and update the spec.
   - After the spec is ready, output in chat (Japanese):
     1) a short spec overview + key points
     2) an Implement-lane copy/paste block: `実装役を起動` + the spec relative path

5. `このレポートをジャッジして`
   - Use `$judge` to review diffs + reports against the spec and decide next actions.

6. `AgentOSを進化して`
   - Use `$agentos-evolve` to propose and apply changes to AGENTS/skills/playbooks/rules.

7. `指示書を実行 <path>`
   - Load the instruction file at `<path>` and execute it as the primary brief.
   - Recommended for manager-led multi-agent operation to reduce chat payload size.

8. `管理役で計画作成`
   - Run manager planning foundation workflow before large cross-project initiatives.
   - Use `.program/manager/templates/program_foundation_template.md` as the planning baseline.
   - `project_type` is free-form text; do not force enum classification.
   - Use `change_vectors` to drive required controls and quality gates.

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
  - The Manager lane MAY commit for orchestration/integration operations and manager workspace maintenance.
  - The Manager lane MAY include commit/branch operations in instructions for other agent threads when controlling parallel execution.
  - Commit messages MUST follow Conventional Commits: `<type>(<scope>): <summary>`.
- Git branch/worktree policy:
  - The Manager lane MAY create/switch/merge non-main branches and manage worktrees for conflict-safe parallel execution.
  - The Manager lane MUST NOT merge into `main` by default; mainline merge requires explicit user instruction.
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
- Manager external context workspace: `.program/manager/`
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
