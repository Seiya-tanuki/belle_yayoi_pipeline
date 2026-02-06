# Report: T-20260206-INTEG-X1 Correlation Key Normalization

## Summary
- Implemented X1 correlation-key normalization across dashboard -> queue -> worker -> export as additive, migration-safe changes.
- Preserved legacy contracts (`rid`, `run_id`, `file_id`, status/reason/outcome semantics) and added normalized metadata/logging (`corr_action_key`, `corr_key`, bounded `sample_corr_keys`).
- Added deterministic X1 tests for observability counters, legacy parity, end-to-end propagation, and reversible mode-switch parity.

## Execution Policy / Phase Gates
- Execution policy: max_parallel=1 (serial only)
- Phase A: executed
- Phase B: executed
- Phase C: executed
- Phase D: deferred (not executed)
- Conflict protocol: no scope conflict

## Scope Boundary Evidence
- V1 (pre-edit): pass
  - STAGED_COUNT:0
  - UNSTAGED_COUNT:0
  - TRACKED_COUNT:0
  - UNTRACKED_COUNT:0
  - OUT_OF_SCOPE: none
- V1 (final): pass
  - STAGED_COUNT:0
  - UNSTAGED_COUNT:9
  - TRACKED_COUNT:9
  - UNTRACKED_COUNT:4
  - OUT_OF_SCOPE: none

## Verification Evidence
1. V3 static normalization contract:
   - Command:
     - `node -e "const fs=require('fs');const files=['gas/DashboardApi.js','gas/Queue.js','gas/OcrWorkerParallel.js','gas/Export.js','gas/Config.js'];const req=[{file:'gas/Config.js',tokens:['corr_key','corr_action_key']},{file:'gas/DashboardApi.js',tokens:['corr_action_key']},{file:'gas/Queue.js',tokens:['corr_key']},{file:'gas/OcrWorkerParallel.js',tokens:['corr_key']},{file:'gas/Export.js',tokens:['corr_key']}];const miss=[];for(const r of req){const s=fs.readFileSync(r.file,'utf8');for(const t of r.tokens){if(!s.includes(t)) miss.push(r.file+':'+t);}}if(miss.length){console.error('MISSING:'+miss.join(','));process.exit(1);}console.log('OK:X1 static normalization tokens present');"`
   - Result: `OK:X1 static normalization tokens present`

2. V4 observability counters:
   - Command:
     - `node tests/x1_correlation_observability_counters.js`
   - Result: `OK: x1_correlation_observability_counters`
   - Deterministic assertions:
     - `missing = 0`
     - `invalid = 0`
     - `mismatch = 0`
     - `derived = 2` (expected deterministic value)

3. V5 compatibility/parity suite:
   - Commands:
     - `node tests/test_dashboard_api_operation_gates.js`
     - `node tests/test_dashboard_api_contract_paths.js`
     - `node tests/test_queue_parity_smoke.js`
     - `node tests/test_export_parity_smoke.js`
     - `node tests/x1_correlation_legacy_parity.js`
   - Result: all pass

4. V6 end-to-end propagation:
   - Command:
     - `node tests/x1_correlation_e2e_dashboard_queue_worker_export.js`
   - Result: `OK: x1_correlation_e2e_dashboard_queue_worker_export`
   - Assertions covered:
     - dashboard action-level `corr_action_key`
     - bounded `sample_corr_keys` (max 20)
     - queue/worker/export deterministic `corr_key` equality (`doc_type::file_id`)
     - missing/mismatch counters remain zero

5. V7 reversible read-path mode switch:
   - Command:
     - `node tests/x1_correlation_mode_switch_parity.js`
   - Result: `OK: x1_correlation_mode_switch_parity`
   - Assertions covered:
     - compatibility and normalized-first parity
     - normalized-first fallback to legacy when normalized key is absent/invalid
     - no cleanup path active

6. V8 baseline regressions:
   - Commands:
     - `node tests/test_csv_row_regression.js`
     - `npm run typecheck`
     - `npm test`
   - Result: all pass
   - Note: `npm run typecheck` initially failed due missing local `tsc`; resolved by running `npm install` in this worktree, then reran and passed.

## AC Traceability
| AC ID | Verification | Evidence |
| --- | --- | --- |
| AC-1 | V1, V2 | Boundary proof pass (no out-of-scope), report includes serial-only and conflict protocol lines. |
| AC-2 | V3, V5 | Static token proof + compatibility tests green with additive metadata only. |
| AC-3 | V4, V6 | Deterministic counters and end-to-end propagation tests green. |
| AC-4 | V7 | Mode-switch parity and legacy fallback verified. |
| AC-5 | V2 | Phase D explicitly deferred and not executed. |
| AC-6 | V4, V6 | Observability signals/counters validated with hard-stop thresholds respected. |
| AC-7 | V5, V7 | Legacy parity and mode-switch parity stayed green. |
| AC-8 | V6 | Cross-stage correlation continuity proven with deterministic equality. |
| AC-9 | V8 | csv/typecheck/full test suite all green. |

## Files Changed
- `gas/Config.js`
- `gas/DashboardApi.js`
- `gas/Queue.js`
- `gas/OcrWorkerParallel.js`
- `gas/Export.js`
- `tests/test_dashboard_api_operation_gates.js`
- `tests/test_dashboard_api_contract_paths.js`
- `tests/test_queue_parity_smoke.js`
- `tests/test_export_parity_smoke.js`
- `tests/x1_correlation_observability_counters.js`
- `tests/x1_correlation_legacy_parity.js`
- `tests/x1_correlation_e2e_dashboard_queue_worker_export.js`
- `tests/x1_correlation_mode_switch_parity.js`

## Observability Signals Implemented
- `X1_CORR_DASH_ACTION` (dashboard action-level key emission)
- `X1_CORR_QUEUE_ITEM` / `X1_CORR_QUEUE_COUNTERS`
- `X1_CORR_WORKER_ITEM` / `X1_CORR_WORKER_COUNTERS`
- `X1_CORR_EXPORT_ITEM` / `X1_CORR_EXPORT_COUNTERS`

## Risks / Notes
- Correlation key cleanup/removal is intentionally deferred to Phase D (out of scope for this track).
- Read-path remains reversible via `BELLE_X1_CORRELATION_READ_MODE` with legacy fallback retained.
