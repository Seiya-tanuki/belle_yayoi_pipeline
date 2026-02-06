実装役を起動

Spec path:
- `.spec/specs/T-20260206-OPS-O1-maintenance-exportrun-tests.md`

Wave:
- Wave 1 / Track O1

Execution goal:
- Implement the spec exactly as written.
- Keep scope conflict-free under parallel execution.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive production-file ownership (O1):
- `gas/MaintenanceMode.js`
- `gas/ExportRunService.js`

2. Exclusive test-file ownership (O1):
- `tests/test_maintenance_mode_operational_paths.js`
- `tests/test_export_run_service_operational_paths.js`
- Optional helper files only with prefix: `tests/o1_*`

3. Forbidden test edits for O1:
- Any test file owned by O2/O3:
  - `tests/test_log_archive_service.js`
  - `tests/test_image_archive_batch_service.js`
  - `tests/test_dashboard_api_contract_paths.js`
  - `tests/test_dashboard_api_operation_gates.js`
- Any existing test file outside O1-owned list unless explicitly approved by consult lead.

4. Shared freeze files (no edits):
- `gas/DocTypeRegistry.js`
- `gas/Config.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/Log.js`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`

5. If spec implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT` with exact file path and reason.
- Do not continue until consult update is provided.

Implementation method:
1. Follow `playbook: tdd-standard` from the spec.
2. Capture Red and Green evidence exactly as required by the spec.
3. Run all verification commands defined by the spec.
4. Produce implementation report in `.spec/reports/` and stop.

Local final boundary check (must pass before reporting done):
- `git diff --name-only`
- Expected changed files are limited to:
  - `gas/MaintenanceMode.js` (optional)
  - `gas/ExportRunService.js` (optional)
  - O1-owned test files under `tests/`

Do not push.
Do not run `clasp deploy`.
