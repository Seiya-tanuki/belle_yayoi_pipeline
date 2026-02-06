---
name: implement-playbook
description: >
  Execute implementation work from a single spec file. Reads the spec meta, selects the playbook,
  performs the changes, runs verification, and writes an English report to .spec/reports/.
---

# Implement Playbook Runner

## Inputs
- Path to a spec under `.spec/specs/...`

## Procedure
1. Read the spec and extract:
   - id, risk, playbook, scope.allow_edit/forbid_edit
   - acceptance criteria IDs, traceability matrix, verification steps
   - TDD Evidence Plan (for `tdd-standard`)
   - Observability Plan or explicit waiver
2. Validate three-drive readiness before editing:
   - every AC ID is mapped to verification step(s)
   - TDD plan exists when required
   - observability plan/waiver exists when required
3. Follow the referenced playbook file under `.agents/playbooks/`.
4. For `playbook: tdd-standard`, execute Red first and capture expected failure evidence.
5. Make the smallest changes required to satisfy acceptance criteria.
6. Execute Green and all remaining verification exactly as written.
7. Run observability verification steps (or carry the approved waiver into the report).
8. Write a report using `.spec/reports/TEMPLATE.md`, including traceability, TDD evidence, and observability evidence.

## Guardrails
- Do not edit specs or AgentOS files.
- Do not push.
- Do not commit by default. Commit only if the spec explicitly requires a commit, or if instructed by Consult lane after review.
- Do not proceed if required three-drive sections are missing.
- Do not skip Red for `tdd-standard` unless the spec includes an explicit approved waiver.
- Do not mark complete without observability evidence or an explicit approved waiver.
- If verification fails or the spec is insufficient, stop and request a spec update.
