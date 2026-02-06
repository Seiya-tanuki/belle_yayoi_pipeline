# ADR-0012: Add manager program planner with change-vector controls

## Status
- proposed

## Context
Manager planning quality depended on ad-hoc reports and manual discipline.
In the refactoring program, gatekeeper revisions occurred because planning artifacts did not enforce:
1. full boundary-proof coverage (`tracked/staged/unstaged/untracked`)
2. report allowlist consistency
3. high-risk quantitative cleanup/no-go controls

Also, rigid enum-based program classification risks forcing poor-fit categories.

## Decision
Introduce manager planning foundation as first-class workflow:
1. Add skill:
   - `.agents/skills/manager-program-planner/SKILL.md`
2. Add templates:
   - `.program/manager/templates/program_foundation_template.md`
   - `.program/manager/templates/track_lock_matrix_template.yaml`
   - `.program/manager/templates/gate_contract_template.yaml`
   - `.program/manager/templates/assumption_ledger_template.yaml`
3. Seed manager registries:
   - `.program/manager/registry/track_lock_matrix.yaml`
   - `.program/manager/registry/gate_contract.yaml`
   - `.program/manager/registry/assumption_ledger.yaml`
4. Add initial foundation report:
   - `.program/manager/reports/P-20260207-manager-planning-foundation.md`
5. Update manager policies/commands and quality gate:
   - `AGENTS.md`
   - `.agents/COMMANDS.md`
   - `.lanes/manager/AGENTS.md`
   - `.program/manager/tools/manager_lane_quality_gate.ps1`
6. Use free-form `project_type` and derive controls from `change_vectors`.

## Consequences
- Positive effects
  - Large-program planning becomes deterministic and auditable.
  - Gate-revision causes are prevented earlier.
  - Manager retains adaptability via free-form `project_type`.
- Negative effects / risks
  - More planning artifacts to maintain.
  - Quality gate maintenance cost increases as templates evolve.

## Verification
1. Run:
   - `powershell -ExecutionPolicy Bypass -File .program/manager/tools/manager_lane_quality_gate.ps1`
2. Confirm:
   - all checks PASS
   - score remains 10/10
3. Confirm manager lane policy references:
   - free-form `project_type`
   - `change_vectors`
   - planner skill usage

## Rollback
1. Revert all files listed in Decision.
2. Remove this ADR.
3. Restore previous manager quality-gate checks and manager lane workflow.
