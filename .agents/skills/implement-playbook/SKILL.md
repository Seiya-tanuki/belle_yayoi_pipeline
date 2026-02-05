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
1. Confirm this is a fresh thread. If not, stop and ask for a new thread.
2. Read the spec and extract:
   - id, risk, playbook, scope.allow_edit/forbid_edit, acceptance criteria, verification
3. Follow the referenced playbook file under `.agents/playbooks/`.
4. Make the smallest changes required to satisfy acceptance criteria.
5. Run verification exactly as written.
6. Write a report using `.spec/reports/TEMPLATE.md`.

## Guardrails
- Do not edit specs or AgentOS files.
- Do not push.
- Do not commit by default. Commit only if the spec explicitly requires a commit, or if instructed by Consult lane after review.
- If verification fails or the spec is insufficient, stop and request a spec update.
