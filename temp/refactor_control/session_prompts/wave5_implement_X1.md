実装役を起動

Spec path:
- `.spec/specs/T-20260206-INTEG-X1-correlation-key-normalization.md`

Wave:
- Wave 5 / Track X1

Execution goal:
- Implement the spec exactly as written (`playbook: migration-safe`).
- Normalize correlation-key semantics across dashboard -> queue -> worker -> export with strict compatibility preservation.

Mandatory precondition:
1. Run this track in a dedicated X1 branch/worktree only.
2. Do not run X1 implementation in a shared dirty branch.
3. This track is serial-only: `max_parallel = 1`.
4. Run V1 boundary proof before starting code edits, and again before finalizing.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive ownership for X1 (from spec allowlist):
- `gas/DashboardApi.js`
- `gas/Queue.js`
- `gas/OcrWorkerParallel.js`
- `gas/Export.js`
- `gas/Config.js`
- `tests/x1_*`
- `tests/test_dashboard_api_operation_gates.js`
- `tests/test_dashboard_api_contract_paths.js`
- `tests/test_queue_parity_smoke.js`
- `tests/test_export_parity_smoke.js`
- X1 report file under `.spec/reports/`

2. Forbidden file edits for X1 (must not change):
- `.spec/specs/*`
- `.agents/*`
- `.lanes/*`
- `gas/Dashboard.html`
- `gas/Log.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/DashboardAuditLog.js`
- `gas/DashboardMaintenanceApi.js`
- `gas/ExportRunService.js`

3. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`.
- Do not continue until consult update is provided.

Implementation method:
1. Follow spec AC/V steps exactly.
2. Execute Phase A -> Phase B -> Phase C in order.
3. Keep Phase D deferred (must not execute cleanup in this track).
4. Preserve backward compatibility for legacy fields/contracts (`rid`, `run_id`, `file_id`, status/reason/outcome semantics).
5. Capture required evidence and create implementation report in `.spec/reports/`.

Required verification (from spec):
- V1 ownership boundary proof (tracked/staged/unstaged/untracked).
- V2 serial execution + phase gate evidence in report (`max_parallel=1`, Phase D deferred).
- V3 static normalization contract proof.
- V4 deterministic observability counter tests (`tests/x1_correlation_observability_counters.js`).
- V5 compatibility/parity suite:
  - `tests/test_dashboard_api_operation_gates.js`
  - `tests/test_dashboard_api_contract_paths.js`
  - `tests/test_queue_parity_smoke.js`
  - `tests/test_export_parity_smoke.js`
  - `tests/x1_correlation_legacy_parity.js`
- V6 end-to-end propagation proof (`tests/x1_correlation_e2e_dashboard_queue_worker_export.js`).
- V7 reversible mode-switch parity proof (`tests/x1_correlation_mode_switch_parity.js`).
- V8 repo regression checks (`csv/typecheck/npm test`).

Supplemental risks (non-blocking, must be monitored during implementation):
1. Dashboard envelope drift from additive correlation metadata.
2. Cross-stage key inconsistency (`doc_type::file_id`) between queue/worker/export.
3. Read-path mode-switch regressions when normalized key is absent.

Hard-stop conditions:
1. Any V1 boundary failure.
2. Any V4/V6 threshold breach (`missing`, `invalid`, or `mismatch` > 0).
3. Any V5/V7 compatibility regression.
4. Any non-owned file requirement (`BLOCKER: SCOPE_CONFLICT`).

Final boundary check (must pass):
- Use spec V1 command exactly.
- Allowed only the X1 allowlist above + report file under `.spec/reports/`.

Do not push.
Do not run `clasp deploy`.
Do not run destructive commands (`rm -rf`, `git reset --hard`, `git clean -fd`).
