# Manager Lane Proposal Pack (Draft)

## Purpose
This directory proposes a new **Manager lane** that reproduces the cross-track leadership behavior used in this refactoring program.

The target is to complement existing lanes:
- Consult lane (spec/review focus)
- Implement lane (single-spec implementation focus)
- **Manager lane (program orchestration focus)**

## Why this pack exists
The current two-lane model intentionally minimizes drift per thread, but it leaves a gap for:
1. Cross-wave progress control
2. Cross-spec conflict prevention
3. Multi-branch/worktree integration management
4. Launch-go/no-go decisions across parallel tracks

## File index
1. `01_retrospective_lead_assignment.md`
- What the leader role actually did in this run

2. `02_manager_lane_charter_draft.md`
- Draft lane mission/scope/pseudo-command

3. `03_permissions_and_governance_matrix.md`
- Proposed authority boundaries and safety rules

4. `04_operating_procedure_wave_control.md`
- Standard operating procedure (SOP) for wave-based parallel delivery

5. `05_skill_and_template_backlog.md`
- Skills/templates needed for stable operation

6. `templates/*`
- Ready-to-use templates for control board, wave prompts, gate decisions, merge readiness, browser validation

7. `skill_drafts/*`
- Draft SKILL files for new manager-lane capabilities

## Adoption note
This pack is intentionally a **proposal only** under `temp/`.
No AgentOS core files are modified yet.

