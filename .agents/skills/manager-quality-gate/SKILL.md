---
name: manager-quality-gate
description: >
  Run manager-lane quality checks against templates, protocol, safety rules,
  and external context artifacts before wave launches and integration actions.
---

# Manager Quality Gate

## Inputs
- Manager workspace root (`.program/manager`)
- Program foundation artifacts (`reports/P-*.md`, lock/gate/assumption registries)

## Procedure
1. Run:
   - `pwsh .program/manager/tools/manager_lane_quality_gate.ps1`
   - or in Windows PowerShell:
     `powershell -ExecutionPolicy Bypass -File .program/manager/tools/manager_lane_quality_gate.ps1`
2. Confirm:
   - all checks are PASS
   - score is 10/10
3. If any check fails:
   - stop launch/integration action
   - fix missing artifacts or policy/template gaps
   - rerun until green
4. Record result in control board update log.

Planning-specific expectations:
1. `project_type` remains free-form text.
2. `change_vectors` are present and used to drive controls.
3. Boundary proof and report allowlist contracts are fully defined.

## Guardrails
- Do not bypass failed quality gate for cross-track launches.
- For simple two-lane fixes without manager orchestration, this gate is optional.
