# ADR-0007: Enforce three-drive quality gates across AgentOS

## Status
- accepted

## Context
The repository already had strong spec-driven guidance and good test defaults, but strict TDD evidence and
data-driven observability requirements were not consistently mandatory across lanes, skills, and templates.
This left room for incomplete verification and weak runtime traceability in implementation reports.

## Decision
Introduce explicit three-drive quality gates (spec-driven, test-driven, data-driven) and align all major
rule files to the same contract.

Files changed:
- `AGENTS.md`
- `.lanes/consult/AGENTS.md`
- `.lanes/implement/AGENTS.md`
- `.spec/specs/TEMPLATE.md`
- `.spec/reports/TEMPLATE.md`
- `.agents/skills/spec-writer/SKILL.md`
- `.agents/skills/spec-check/SKILL.md`
- `.agents/skills/implement-playbook/SKILL.md`
- `.agents/skills/judge/SKILL.md`
- `.agents/playbooks/tdd-standard.md`
- `.agents/playbooks/refactor-boundary.md`
- `.agents/playbooks/migration-safe.md`

Behavior changes:
- Specs now require AC IDs, traceability mapping, and verification linkage.
- `tdd-standard` now requires Red/Green evidence (or explicit approved waiver).
- Runtime behavior changes now require observability plans and evidence (or explicit approved waiver when allowed).
- Judge checks now include three-drive evidence gates before acceptance.

## Consequences
- Positive:
  - Higher implementation determinism and lower requirement drift.
  - Stronger objective completion criteria via traceability and Red/Green evidence.
  - Better incident/debug readiness through explicit observability requirements.
- Negative / risks:
  - Increased spec and review overhead, especially for small changes.
  - Higher risk of process friction if waiver criteria are overused or unclear.

## Verification
Smallest reliable checks:
1. Confirm all updated rule files contain matching three-drive requirements.
2. Confirm the spec template includes AC IDs, traceability matrix, TDD evidence plan, and observability plan.
3. Confirm the report template and judge skill require corresponding evidence.

## Rollback
Revert the file edits listed above and delete `ADR-0007-three-drive-quality-gates.md`.
