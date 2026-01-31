---
id: T0001
title: "TITLE"
created_at: "2026-01-31T00:00:00+09:00"
updated_at: "2026-01-31T00:00:00+09:00"
depends_on: []
auto_advance_allowed: false
risk_level: medium
destructive_ops: false

status_policy:
  codex_max_status: done_pending_review

authority:
  # List the authoritative sources Codex must read for this task.
  sources:
    - "ai/contracts/AUTHORITY.md"
    - "ai/contracts/CODEX_TASK_EXECUTION_CONTRACT.md"
    - "ai/contracts/CODEX_REPORT_CONTRACT.md"
    - "ai/rules/00_base.md"
    - "ai/rules/10_repo_layout.md"
  # Optional: plan_path / pack_ref
  # plan_path: "ai/plans/..."
  # pack_ref: "ai/packs/..."

scope:
  # Globs/prefixes. Keep tight.
  allow_paths:
    - "src/"
    - "tests/"
    - "tools/"
  deny_paths:
    - "ai/"
    - ".git/"
    - ".ai/"

acceptance:
  # Machine-checkable acceptance steps. Each step MUST be runnable.
  machine:
    - id: "lint"
      run: "echo \"TODO: replace with repo lint command\""
    - id: "tests"
      run: "echo \"TODO: replace with repo test command\""
  # Human checks (for Belle/human review). If none, set to [].
  human:
    - "Review the TaskReport for scope discipline and risks."

reporting:
  # Extra report requests beyond the standard report contract.
  extra_requests: []
  # Optional: request specific sections (usually not needed).
  required_sections: []
---

# Context
Write the context needed to execute this task without guessing.

# Goals
1. Goal 1
2. Goal 2

# Non-goals
1. Explicitly list what must NOT be done.

# Requirements
1. Any constraints, performance targets, compatibility notes.

# Steps (if needed)
1. Step guidance (avoid micromanagement; focus on constraints).

# Notes
Anything else.
