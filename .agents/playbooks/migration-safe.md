# Playbook: migration-safe

## When to use
Use for changes with high blast radius or irreversible effects (schema changes, data migrations, large API changes).

## Preconditions
1. The spec must be `risk: high` and include:
   - rollback plan
   - verification plan
   - safety constraints (no destructive commands without approval)

## Steps
1. Identify what can be made reversible (feature flags, staged migrations, compatibility layers).
2. Implement in phases:
   - phase A: add new path (backward compatible)
   - phase B: backfill / migrate
   - phase C: switch reads
   - phase D: cleanup (only after confirmation)
3. Add monitoring or checks if feasible (logs, counters, invariants).
4. Verify with explicit commands and clear pass/fail criteria.

## Guardrails
- Stop immediately if rollback is unclear.
- Do not run destructive commands without explicit approval.
