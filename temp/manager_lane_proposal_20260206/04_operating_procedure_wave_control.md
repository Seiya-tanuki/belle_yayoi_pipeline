# Manager Lane SOP: Wave Control and Integration

## 0. Bootstrap
1. Open/update control board.
2. Confirm active branches/worktrees.
3. Confirm current wave objective and done gate.
4. Publish current state summary.

## 1. Wave planning
1. Define tracks and max parallel.
2. Build ownership matrix (`scope.allow_edit` non-overlap).
3. Mark shared freeze files.
4. Define wave entry gate and exit gate.

## 2. Consult phase orchestration
1. Generate consult prompt packet per track.
2. Trigger gatekeeper review prompt.
3. Triage gatekeeper output into:
   - Accept
   - Revise (blocking)
4. Apply/route required fixes.
5. Move wave to implement-launch-ready only on full Accept.

## 3. Implement phase orchestration
1. Generate implement prompt packet per track.
2. Require:
   - fresh thread
   - dedicated branch/worktree
   - boundary proof before and after edits
3. Require conflict hard-stop protocol.

## 4. Completion intake and judgment
1. For each completed track:
   - inspect report
   - inspect diff scope
   - rerun key evidence commands
2. Decide:
   - Accept
   - Revise
3. Update track status and next action.

## 5. Wave closure
Wave closes only when:
1. all tracks are judged Accept
2. wave regression gate is green
3. no open blocker remains

## 6. Integration branch stage (pre-main)
1. Create integration branch from control branch tip.
2. Merge track branches in planned order.
3. Resolve conflicts preserving all track intents.
4. Run targeted track tests first, then full regression.
5. Publish integration readiness summary.

## 7. Browser validation handoff
1. Provide exact branch/worktree and commit IDs.
2. Provide `clasp` safety checks and push steps.
3. Provide browser scenario checklist:
   - critical flows
   - observability signals
   - rollback trigger conditions

## 8. Escalation handling
If progress cannot continue:
1. post blocker line with severity and impact
2. freeze affected tracks
3. provide two safe options with recommendation

## 9. Logging discipline
Every state transition must be appended to control board update log with:
1. date
2. exact action
3. decision rationale
4. evidence reference

