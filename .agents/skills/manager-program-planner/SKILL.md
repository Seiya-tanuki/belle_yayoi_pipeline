---
name: manager-program-planner
description: >
  Build manager planning foundation artifacts for large cross-project initiatives.
  Use when Manager lane needs a durable execution baseline before launching consult/implement waves.
---

# Manager Program Planner

## Inputs
1. Program objective and expected completion conditions.
2. Baseline branch/commit range.
3. Known constraints and risks.

## Procedure
1. Create or update a planning foundation report:
   - `.program/manager/reports/P-<YYYYMMDD>-<slug>-program-foundation.md`
2. In the report:
   - set `project_type` as free-form text (do not force enum classification)
   - define `change_vectors` as the control-driving metadata
3. Create or update registries:
   - `.program/manager/registry/track_lock_matrix.yaml`
   - `.program/manager/registry/gate_contract.yaml`
   - `.program/manager/registry/assumption_ledger.yaml`
4. Synchronize wave prompt packs with the lock matrix and gate contract.
5. Run manager quality gate:
   - `powershell -ExecutionPolicy Bypass -File .program/manager/tools/manager_lane_quality_gate.ps1`
6. If the quality gate fails:
   - stop launch
   - fix artifacts
   - rerun until green
7. Record planning update in `control_board.md` and snapshot when needed.

## Required report sections
1. Meta (`project_type`, `change_vectors`, baseline commit range).
2. Scope and non-goals.
3. Ownership and lock strategy.
4. Boundary proof standard (`tracked/staged/unstaged/untracked` coverage).
5. Gate contract mapping (spec/test/data + high-risk quantitative gates).
6. Branch/worktree and integration strategy.
7. Rollback/no-go policy.
8. Assumption ledger linkage with expiry rules.

## Guardrails
1. Do not launch cross-track execution without planning foundation artifacts.
2. Do not classify program risk from `project_type` alone; use `change_vectors`.
3. If a required control cannot be defined, return `HOLD` and escalate.
