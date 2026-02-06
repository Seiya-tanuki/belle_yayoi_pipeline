---
name: git-tag-first
description: >
  Tag-first Git runbook: treat tags as immutable restore points, use tag-then-delete for branch cleanup,
  keep origin/HEAD consistent after default-branch changes, and apply agreed naming conventions.
---

# Git Tag-First Runbook

## Principles
1. Branches are mutable work areas.
2. Stable milestones are recorded as annotated tags (restore points).
3. Cleanup follows tag-then-delete (archive tag first, then delete the branch).

## Naming conventions (adopted)
### Tags
- Important tags MUST be annotated: `git tag -a <tag> -m "<message>"`
- Prefixes (category): `checkpoint/`, `archive/`, `release/`, `hotfix/`
- Format: `category/<target>-<summary>-YYYYMMDD` (optionally `-HHMM`)
- Examples:
  - `checkpoint/main-ocr-genconfig-20260205`
  - `archive/feat-mcp-observability-20260112`
  - `release/v1.11.0`

### Branches (work areas)
- `feat/<slug>-YYYYMMDD`
- `fix/<slug>-YYYYMMDD`
- `chore/<slug>-YYYYMMDD`
- `docs/<slug>-YYYYMMDD`
- `spike/<slug>-YYYYMMDD`

### Commits
- MUST follow Conventional Commits: `<type>(<scope>): <summary>`
- Recommended types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`
- Example: `fix(export): prevent duplicate rows on retry`

## Checkpoint tag (milestone restore point)
1. Inspect state:
   - `git status`
   - `git log -n 20 --oneline`
2. Create an annotated checkpoint tag:
   - `git tag -a checkpoint/<target>-<summary>-YYYYMMDD -m "checkpoint: <why>"`
3. Optional: create a matching local note in the tag message (why / what changed / verification).

## Tag-then-delete (archive before deleting a branch)
1. Ensure you are on a safe branch (e.g., `main`) and the branch to archive is fully identified.
2. Create an annotated archive tag at the branch tip:
   - Normalize the branch name to a tag-safe slug (replace `/` with `-`).
   - If the branch slug already ends with `-YYYYMMDD` (or `-YYYYMMDD-HHMM`), use `archive/<branch_slug>` (avoid duplicate dates).
   - Otherwise, use `archive/<branch_slug>-YYYYMMDD`.
   - Example:
     - `git tag -a archive/<branch_slug> -m "archive: <why>" <branch>`
3. Verify:
   - `git show archive/<branch_slug>` (or `archive/<branch_slug>-YYYYMMDD`)
4. Delete branch locally (only after tag exists):
   - `git branch -d <branch>` (or `-D` only with explicit approval, since it can discard unmerged work)

## origin/HEAD alignment (after default branch changes)
If the remote default branch changes (e.g., `master` -> `main`) and local `origin/HEAD` is stale:
1. Fetch and prune, including tags:
   - `git fetch --prune --tags`
2. Auto-detect remote HEAD:
   - `git remote set-head origin -a`
3. Confirm:
   - `git symbolic-ref refs/remotes/origin/HEAD`

## Safety notes
- This runbook does NOT grant permission to push. Push remains gated by the two-step approval flow in `git-safe`.
- Force-push variants (`--force`, `-f`, `--force-with-lease`) are forbidden for the agent. If required, a human must run them intentionally.
