# ADR-0008: Bootstrap Manager lane and external context workspace

## Status
- proposed

## Context
The repository had two lanes (consult/implement) that optimized local thread focus but lacked a first-class owner for:
1. cross-wave orchestration
2. parallel scope governance
3. integration branch management
4. durable recovery after context compression

Recent multi-wave refactoring required ad-hoc manager behavior to keep parallel tracks stable.

## Decision
Bootstrap manager-lane related assets without changing existing lane rules yet:
1. Add manager lane policy file:
   - `.lanes/manager/AGENTS.md`
2. Add manager skills:
   - `.agents/skills/manager-orchestrator/SKILL.md`
   - `.agents/skills/parallel-scope-designer/SKILL.md`
   - `.agents/skills/integration-merge-manager/SKILL.md`
   - `.agents/skills/context-ledger-manager/SKILL.md`
3. Add durable external context workspace:
   - `.program/manager/*`
4. Add templates for control board, prompt packets, gatekeeper decisions, merge readiness, browser validation, and recovery snapshots.

Risk classification (agentos-evolve protocol): Type B (medium), because this introduces a new lane policy and new mandatory operational artifacts.

## Consequences
- Positive effects
  - Program-level coordination becomes explicit and repeatable.
  - Recovery after context compression is improved via snapshots and active context files.
  - Parallel conflict control and integration workflow become standardized.
- Negative effects / risks
  - Additional operational overhead from board/snapshot maintenance.
  - Until root AGENTS integration is completed, manager lane is available but not yet part of top-level pseudo-command flow.
  - Type B change requires human review before relying on it as default standard.

## Verification
Smallest reliable checks:
1. Confirm all new manager files exist under `.lanes/manager`, `.agents/skills/*`, and `.program/manager`.
2. Confirm manager policy references existing paths only.
3. Confirm templates cover:
   - control board
   - prompt packet
   - gatekeeper decision
   - integration readiness
   - browser validation
   - context snapshot and recovery checkpoint

## Rollback
1. Remove manager-lane files:
   - `.lanes/manager/`
   - manager-related skill directories under `.agents/skills/`
   - `.program/manager/`
2. Remove this ADR file.
3. Keep consult/implement lanes unchanged.

