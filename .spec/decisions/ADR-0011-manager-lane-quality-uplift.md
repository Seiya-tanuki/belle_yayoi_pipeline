# ADR-0011: Manager lane quality uplift with executable gate

## Status
- proposed

## Context
Manager lane bootstrap was functional but still had reliability gaps compared with the proven `temp` run:
1. prompt templates were not explicit enough for repeatable cross-thread execution
2. there was no executable launch-readiness gate
3. migration relationship from `temp/refactor_control` to `.program/manager` was not explicit

These gaps limited confidence for long-running orchestration and restart recovery.

## Decision
Apply a focused quality uplift:
1. Add high-fidelity prompt templates:
   - `.program/manager/templates/consult_track_prompt_template.md`
   - `.program/manager/templates/consult_gatekeeper_prompt_template.md`
   - `.program/manager/templates/implement_track_prompt_template.md`
2. Strengthen wave packet template:
   - `.program/manager/templates/wave_prompt_packet_template.md`
3. Add executable quality gate and skill:
   - `.program/manager/tools/manager_lane_quality_gate.ps1`
   - `.agents/skills/manager-quality-gate/SKILL.md`
4. Add migration and evaluation artifacts:
   - `.program/manager/migrations/temp_refactor_control_mapping_20260206.md`
   - `.program/manager/reports/temp_comparison_self_analysis_20260206.md`
5. Require manager quality gate pass in manager lane policy:
   - `.lanes/manager/AGENTS.md`

## Consequences
- Positive effects
  - Manager launch readiness is now machine-checkable.
  - Prompt quality is standardized and closer to proven production prompts.
  - Recovery continuity is improved with explicit migration and snapshot evidence.
- Negative effects / risks
  - Slight maintenance overhead to keep quality-gate needles aligned with template evolution.
  - Potential false failures if template wording changes without updating the gate script.

## Verification
1. Run:
   - `powershell -ExecutionPolicy Bypass -File .program/manager/tools/manager_lane_quality_gate.ps1`
2. Confirm:
   - `CHECKS_PASS:7/7`
   - `SCORE_10:10`
3. Confirm report exists:
   - `.program/manager/reports/temp_comparison_self_analysis_20260206.md`

## Rollback
1. Revert files listed in Decision section.
2. Remove this ADR.
3. Restore previous manager lane policy and templates.
