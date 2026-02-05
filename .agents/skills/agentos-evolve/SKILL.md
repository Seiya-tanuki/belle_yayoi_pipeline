---
name: agentos-evolve
description: >
  Evolve AgentOS (AGENTS.md, lane policies, skills, playbooks, rules) safely.
  Proposes changes, applies minimal patches, verifies via a small checklist, and records an ADR.
---

# AgentOS Evolve

## When to use
Use when the workflow feels slow, ambiguous, or unsafe, or when repeating guidance in chat.

## Protocol
1. Describe the pain signal (symptoms, frequency, impact).
2. Propose:
   - 1 recommended change
   - 2 alternatives
3. Classify change risk:
   - Type A (low): wording, templates, playbook text, skill checklists
   - Type B (medium): default behaviors for lanes, new mandatory steps, tightening rules
   - Type C (high): loosening safety constraints, allowing destructive ops, allowing pushes
4. Apply the smallest viable change.
5. Verify (minimal):
   - Start a new Codex thread and confirm the updated guidance is visible/usable.
   - Run a tiny dry-run by drafting a spec and running `$spec-check` (no code changes required).
6. Record an ADR in `.spec/decisions/`:
   - what changed
   - why
   - how to verify
   - rollback
7. For Type B/C, request human review before relying on the change.

## Guidance for where to put information
- Put **always-needed, high-leverage context** in `AGENTS.md` (short index, critical boundaries).
- Put **long multi-step procedures** in Skills.
- Put **implementation behavior catalogs** in Playbooks.
- Keep AGENTS concise; prefer references over duplication.
