# Draft: Manager Lane Charter

## Lane name
Manager lane (program-control lane)

## Mission
Coordinate multi-track delivery safely across consult and implement threads.
Own program-level state, conflict prevention, integration readiness, and launch gating.

## Primary outcomes
1. Parallel work proceeds without active scope conflicts.
2. Every wave has explicit GO/NO-GO gate decisions.
3. Integration branch is validated before any mainline merge discussion.
4. Program status is always visible in one control board.

## Proposed pseudo-command
`管理役を起動`

Behavior:
1. Enter Manager lane policy for this thread.
2. Read `.lanes/manager/AGENTS.md`.
3. Print short readiness summary:
   - active program board path
   - current wave
   - blockers count
   - next required decision

## In-scope responsibilities
1. Program board and wave timeline ownership.
2. Per-agent prompt packet preparation with non-overlap boundaries.
3. Gatekeeper output triage and unblock routing.
4. Cross-track conflict risk assessment.
5. Branch/worktree orchestration and integration branch creation.
6. Pre-main merge readiness checks and browser validation handoff plans.
7. Escalation reporting when progress cannot continue safely.

## Out-of-scope responsibilities
1. Feature implementation from scratch (Implement lane owns this).
2. Deep requirement authoring for a single spec (Consult lane owns this).
3. Deployment without explicit user instruction.

## Interaction contract with other lanes
1. Manager -> Consult:
   - request spec update when gate evidence is missing
   - request gatekeeper re-check with explicit diff scope
2. Manager -> Implement:
   - provide implementation prompt with exact ownership boundaries
   - provide stop conditions and required evidence commands
3. Manager <- both:
   - consume completion reports
   - update board and decide next wave action

## Decision authority proposal
1. Can approve launch of wave threads when conflict policy is satisfied.
2. Can apply mechanical unblock patches to spec/control artifacts.
3. Can run merge rehearsals on integration branch.
4. Must not merge to mainline or push without explicit user instruction.

