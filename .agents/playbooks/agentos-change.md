# Playbook: agentos-change

## When to use
Use when updating AgentOS itself (AGENTS.md, skills, playbooks, rules).

## Steps
1. Describe the pain signal (what keeps going wrong or taking too long?).
2. Propose 1 recommended change + 2 alternatives.
3. Classify the change risk:
   - Type A (low): wording, templates, playbook text, non-behavioral tweaks
   - Type B (medium): behavior changes to Implement lane defaults, new required steps, rules tightening
   - Type C (high): loosening safety constraints, allowing destructive ops, allowing pushes
4. Apply the smallest change that addresses the pain.
5. Verify:
   - start a new Codex thread and confirm the updated guidance is visible
   - run a tiny dry-run spec through Consult -> Implement (no actual code changes required)
6. Record an ADR under `.spec/decisions/`.
7. Stop and request human review for Type B/C changes.

## Guardrails
- Prefer moving long procedures into skills to keep AGENTS concise.
- Never loosen safety boundaries without explicit approval.
