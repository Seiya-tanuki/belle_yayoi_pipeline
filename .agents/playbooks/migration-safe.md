# Playbook: migration-safe

## When to use
Use for changes with high blast radius or irreversible effects (schema changes, data migrations, large API changes).

## Preconditions
1. The spec must be `risk: high` and include:
   - rollback plan
   - verification plan
   - safety constraints (no destructive commands without approval)
   - observability plan with thresholds and abort criteria

## Steps
1. Identify what can be made reversible (feature flags, staged migrations, compatibility layers).
2. Implement in phases:
   - phase A: add new path (backward compatible)
   - phase B: backfill / migrate
   - phase C: switch reads
   - phase D: cleanup (only after confirmation)
3. Add and verify monitoring/checks (logs, counters, invariants) before and during each phase.
4. Verify with explicit commands, clear pass/fail criteria, and abort conditions.

## Guardrails
- Stop immediately if rollback is unclear.
- Stop immediately if observability cannot confirm migration safety.
- Do not run destructive commands without explicit approval.
