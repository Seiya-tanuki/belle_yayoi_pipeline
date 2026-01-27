> HISTORICAL: Do not use this document as current spec.

# Checklists

## A) Audit checklist (run before refactor PR)
1) Identify entry points (GAS functions) and call graph
2) List all Script Properties used, default values, and consumers
3) Enumerate Sheets and their schema (headers)
4) Enumerate Logs and their writers + dedupe behavior
5) Identify legacy files and unreachable code
6) Identify performance hotspots:
   - per-cell writes
   - repeated Drive scans
   - repeated JSON parse/stringify
7) Identify concurrency/locking paths:
   - LockService usage
   - claim cursor and stale reaper behavior
8) Confirm tests map to modules and behaviors

## B) Deletion checklist
1) Confirm no references via:
   - rg -n "SYMBOL"
   - runtime entry points
2) Add tests or extend existing tests to lock in behavior
3) Delete code in small commits
4) Record deletions in docs/refactor/04_deprecation_registry.md
5) After removing *_test entrypoints, run belle_triggerAuditOnly_v0 once from Apps Script editor and confirm no triggers reference *_test handlers

## C) Naming/structure checklist
1) No new "v0" suffix unless legacy boundary requires it
2) Domain prefixes present
3) Helper functions in Code.js are side-effect-free when feasible
4) Export mapping remains deterministic (no hidden state)
