# Manager Lane Enablement Backlog

## Proposed skills

### 1) `manager-orchestrator`
Purpose:
- Run wave lifecycle from planning to closure.

Must support:
1. control board updates
2. wave state transitions
3. prompt packet generation orchestration
4. blocker escalation formatting

### 2) `parallel-scope-designer`
Purpose:
- Build non-overlap ownership boundaries for parallel threads.

Must support:
1. ownership matrix generation
2. freeze file declaration
3. scope overlap detection
4. hard-stop policy insertion into prompts/specs

### 3) `integration-merge-manager`
Purpose:
- Build and validate pre-main integration branch.

Must support:
1. merge order planning
2. conflict checklist
3. targeted + full regression plan
4. integration readiness report output

## Existing skills reused by manager lane
1. `judge`
2. `spec-check`
3. `spec-writer`
4. `git-safe`

## Template set required
1. `manager_control_board_template.md`
- Single source of operational truth.

2. `wave_prompt_packet_template.md`
- Per-wave prompt scaffolding for consult/implement/gatekeeper.

3. `gatekeeper_decision_log_template.md`
- Normalized Accept/Revise capture.

4. `integration_merge_readiness_template.md`
- Pre-main merge evidence summary.

5. `browser_validation_checklist_template.md`
- Manual validation steps for app behavior in browser.

## Stability requirements for skills/templates
1. Deterministic section IDs (for automation).
2. Flat, parseable status vocabulary:
- `consult-launch-ready`
- `implement-launch-ready`
- `in-progress`
- `accepted`
- `closed`
- `blocked`
3. Mandatory evidence links or command outputs for each gate decision.
4. Explicit ownership/freeze lists in every wave prompt pack.

## Suggested rollout
1. Phase 1:
- adopt templates under `temp` only.
- dry-run on one future wave.

2. Phase 2:
- create `.lanes/manager/AGENTS.md`
- add pseudo-command `管理役を起動` to root `AGENTS.md`
- install manager skills under `.agents/skills/`

3. Phase 3:
- add ADR for lane model change
- mark manager lane as standard for multi-track refactors

