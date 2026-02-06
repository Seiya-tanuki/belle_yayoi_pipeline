実装役を起動

Spec path:
- `.spec/specs/T-20260206-OPS-O2-archive-services-tests.md`

Wave:
- Wave 1 / Track O2

Execution goal:
- Implement the spec exactly as written.
- Keep scope conflict-free under parallel execution.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive production-file ownership (O2):
- `gas/LogArchiveService.js`
- `gas/ImageArchiveBatchService.js`
- `gas/ArchiveNaming.js` (only if required and explicitly justified)

2. Exclusive test-file ownership (O2):
- `tests/test_log_archive_service.js`
- `tests/test_image_archive_batch_service.js`
- Optional helper files only with prefix: `tests/o2_*`

3. Forbidden test edits for O2:
- Any test file owned by O1/O3:
  - `tests/test_maintenance_mode_operational_paths.js`
  - `tests/test_export_run_service_operational_paths.js`
  - `tests/test_dashboard_api_contract_paths.js`
  - `tests/test_dashboard_api_operation_gates.js`
- Any existing test file outside O2-owned list unless explicitly approved by consult lead.

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
  - `gas/LogArchiveService.js` (optional)
  - `gas/ImageArchiveBatchService.js` (optional)
  - `gas/ArchiveNaming.js` (optional, only with explicit justification)
  - O2-owned test files under `tests/`

Do not push.
Do not run `clasp deploy`.
