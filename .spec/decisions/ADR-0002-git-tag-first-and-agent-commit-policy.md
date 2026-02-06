# ADR-0002: Adopt tag-first Git runbook and allow agent commits

## Status
- accepted

## Context
This repo is often modified with AI assistance, which can produce large or fast-moving changes.
Relying on branches alone makes it hard to identify a safe restore point.
Additionally, the previous AgentOS rules forbade agent commits and pushes, which added friction after review when changes were clearly acceptable.

## Decision
Update AgentOS Git policies to:
- Treat branches as mutable work areas and tags as stable restore points (tag-first).
- Adopt naming conventions:
  - Conventional Commits for commit messages: `<type>(<scope>): <summary>`.
  - Tag prefixes: `checkpoint/`, `archive/`, `release/`, `hotfix/` with `YYYYMMDD` date suffix.
- Allow the agent to stage changes (including `git add -A` and `git add .`) with a preference for `git add -p` or explicit paths when practical.
- Allow the agent to commit after a Consult-lane review/judgement marks the work acceptable (e.g., `$judge` => Accept).
- Keep push gated:
  - The agent must not push by default.
  - Push is permitted only when explicitly instructed by the user and only via a two-step approval flow (proposal/explanation, then execution after approval).
- Add a dedicated runbook skill for tag-first workflows (`git-tag-first`).

Files changed:
- `AGENTS.md`
- `.lanes/consult/AGENTS.md`
- `.lanes/implement/AGENTS.md`
- `.agents/skills/git-safe/SKILL.md`
- `.agents/skills/git-tag-first/SKILL.md`
- `codex/rules/default.rules`

## Consequences
- Positive:
  - Clear, stable restore points via annotated tags.
  - Reduced friction: acceptable changes can be committed by the agent after review.
  - Push remains guarded to avoid accidental remote changes/deletions.
- Negative / risks:
  - Allowing broad staging (`git add -A` / `git add .`) increases the risk of committing unrelated local changes; mitigation is the staged-diff checklist in `git-safe`.
  - Two-step push approval relies on user attention to the proposal (especially for deletions).

## Verification
Smallest reliable checks:
1. Open `AGENTS.md` and confirm the Git staging/commit/push policies and naming conventions are present.
2. Open `.agents/skills/git-safe/SKILL.md` and confirm it documents staging/commit guardrails and the two-step push flow.
3. Open `.agents/skills/git-tag-first/SKILL.md` and confirm tag prefixes, tag-then-delete, and origin/HEAD alignment guidance exist.
4. Open `codex/rules/default.rules` and confirm:
   - `git commit` is allowed
   - `git push` is prompted
   - force-push variants are forbidden

## Rollback
Revert the file edits listed above and delete `ADR-0002-git-tag-first-and-agent-commit-policy.md`.
