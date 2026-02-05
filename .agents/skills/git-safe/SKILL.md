---
name: git-safe
description: >
  Safe Git workflow for agents: inspect changes, stage/commit with guardrails, and prepare review-friendly diffs.
  Supports the repo's tag-first process while keeping push gated behind explicit user approval.
---

# Git Safe

## Always allowed (read-only inspection)
1. `git status`
2. `git diff` (and `git diff --staged`)
3. `git log -n <N> --oneline`
4. `git show <rev>` (single commit/tag inspection)
5. `git tag -l` (list tags)

## Staging (agent-allowed)
- The agent MAY stage changes, including `git add -A` and `git add .`.
- Preferred when practical: `git add -p` or explicit paths (reduces accidental staging).
- Avoid staging unrelated workspace changes (confirm `git status` first).

## Committing
- Commit is allowed after a Consult-lane judgement marks the implementation as acceptable (e.g., `$judge` => Accept).
- Commit message MUST follow Conventional Commits: `<type>(<scope>): <summary>`.
- Minimal safe commit checklist:
  1. Confirm scope with `git status` and `git diff`.
  2. Stage intentionally (see staging guidance above).
  3. Confirm staged contents with `git diff --staged`.
  4. Commit with a Conventional Commit message.

## Pushing (two-step approval flow)
- The agent MUST NOT push by default.
- The agent MAY push only when explicitly instructed by the user, and only via a two-step flow:
  1. Propose: list exact commands to run, and describe what will change (especially deletions like remote branch deletes).
  2. Execute: run those commands only after the user explicitly approves the proposal.

## Tag-first note
- For tag naming and the tag-then-delete runbook, see the `git-tag-first` skill.
