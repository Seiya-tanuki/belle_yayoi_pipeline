# T-20260206-OPS-O1: Operational test coverage for MaintenanceMode and ExportRunService

## Meta
- id: T-20260206-OPS-O1
- owner_lane: consult -> implement
- risk: medium
- playbook: tdd-standard
- scope:
  - allow_edit:
    - gas/MaintenanceMode.js
    - gas/ExportRunService.js
    - tests/
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
- web_search: disabled
- decision_refs:
  - none

## Goal
Add deterministic operational tests for maintenance-mode and export-run execution paths so that success and failure contracts are verified by reproducible Node test runs. Limit runtime code edits to `gas/MaintenanceMode.js` and `gas/ExportRunService.js` only when needed to satisfy existing contract expectations, with no scope expansion.

## Non-goals
- No edits to `gas/Queue.js`, `gas/Export.js`, `gas/OcrWorkerParallel.js`, or any `gas/Dashboard*` files.
- No edits to shared freeze files:
  - `gas/DocTypeRegistry.js`
  - `gas/Config.js`
  - `gas/Code.js`
  - `gas/ExportEntrypoints.js`
  - `gas/Log.js`
  - `tests/test_reset_headers.js`
  - `tests/test_doc_type_registry_callsite_smoke.js`
- No new product features, no new scheduler/trigger behavior, and no new public/global function names.
- No deployment actions (`clasp deploy` prohibited; no `clasp push` in this task).

## Context / Constraints
- Primary runtime is GAS under `gas/`; local tests are Node VM harness tests under `tests/`.
- Determinism is required: tests must not depend on wall-clock timing, random values, network, or real Google services.
- Use stubs/mocks for GAS globals as needed (`PropertiesService`, `SpreadsheetApp`, `DriveApp`, `LockService`, `ScriptApp`, `Session`, `Utilities`).
- If runtime code updates are required, keep changes minimal and contract-preserving for existing return object shape (`ok`, `reason`, `message`, `data`).
- Keep ASCII-only comments in `gas/*.js`.
- Runtime behavior changes: no planned expansion; only contract-preserving fixes are allowed if Red evidence reveals a defect.

## Proposed approach
1. Add focused tests for `MaintenanceMode` paths (state/guard/enter/exit) with deterministic stubs and fixed timestamps.
2. Add focused tests for `ExportRunService` maintenance run paths (blocked/failure/success) with deterministic stubs and fixed run metadata.
3. If tests expose defects, apply minimal fixes only in `gas/MaintenanceMode.js` or `gas/ExportRunService.js` to align behavior with existing contracts.
4. Run targeted tests first, then repository verification sequence.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] Deterministic tests cover `MaintenanceMode` success/failure operational paths, including at minimum:
   - `belle_maint_requireMode_` (match and mismatch result)
   - `belle_maint_quiesceAndEnter_` failure branches (`ALREADY_MAINTENANCE`, `LOCK_BUSY`, `TRIGGERS_ACTIVE`, propagated live-check failure such as `LIVE_PROCESSING` or `INVALID_QUEUE_HEADER`) and success branch (`OK` with maintenance data)
   - `belle_maint_exit_` success contract
2. [AC-2] Deterministic tests cover `ExportRunService` maintenance run success/failure paths, including at minimum:
   - missing sheet id failure (`MISSING_SHEET_ID`)
   - export exception (`EXPORT_EXCEPTION`)
   - blocked export (`EXPORT_BLOCKED`) for guard/error paths, including guard-specific message format (`Export blocked: <reason>`) and generic failure message path (`Export failed.`)
   - report creation failure passthrough (`reason`/`message` from report stage)
   - success contract (`OK`) with `data.run_id`, `data.report`, `data.export`, `data.clear`, and timing object
3. [AC-3] For covered paths, tests assert returned contract fields `reason`, `message`, and `data` (presence and expected values/shape where applicable), and implementation changes stay within allowed scope without unplanned runtime expansion.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V1, V3 | Targeted maintenance test output shows deterministic pass and explicit assertions for failure/success reasons/messages/data; optional runtime diffs (if any) remain in allowed files only. |
| AC-2 | V2, V3 | Targeted export-run test output shows deterministic pass for blocked/failure/success paths and contract assertions; optional runtime diffs (if any) remain in allowed files only. |
| AC-3 | V1, V2, V3, V4 | Test logs prove `reason/message/data` assertions; diff scope check proves boundaries; typecheck + full suite confirm no unintended regressions. |

## Verification
1. [V1] Maintenance path tests (must pass in Green):
   - `node tests/test_maintenance_mode_operational_paths.js`
   - Pass criteria: exit code `0`; output includes a terminal OK line (for example `OK: test_maintenance_mode_operational_paths`); assertions validate `reason`, `message`, and `data` for defined branches.
2. [V2] Export-run path tests (must pass in Green):
   - `node tests/test_export_run_service_operational_paths.js`
   - Pass criteria: exit code `0`; output includes a terminal OK line (for example `OK: test_export_run_service_operational_paths`); assertions validate `reason`, `message`, and `data` for failure and success branches.
3. [V3] Scope/boundary proof (must pass):
   - `git diff --name-only`
   - `node -e "const fs=require('fs');const defs={ 'gas/MaintenanceMode.js':['belle_maint_getTtlMinutes_','belle_maint_getState_','belle_maint_getStateResult_','belle_maint_requireMode_','belle_maint_setMode_','belle_maint_checkNoLiveProcessing_','belle_maint_hasOcrTriggers_','belle_maint_quiesceAndEnter_','belle_maint_exit_'], 'gas/ExportRunService.js':['belle_export_run_buildRunId_','belle_export_run_extractCsvFiles_','belle_export_run_collectCounts_','belle_export_run_clearSheet_','belle_export_run_createReport_','belle_export_run_writeSummary_','belle_export_run_maintenance_'] };let ok=true;for(const f of Object.keys(defs)){const code=fs.readFileSync(f,'utf8');const found=[...code.matchAll(/function\\s+([A-Za-z0-9_]+)\\s*\\(/g)].map(m=>m[1]);const exp=defs[f];const miss=exp.filter(x=>!found.includes(x));const extra=found.filter(x=>!exp.includes(x));if(miss.length||extra.length){console.error(f,JSON.stringify({missing:miss,extra:extra}));ok=false;}}process.exit(ok?0:1);"`
   - Pass criteria: changed files are limited to:
     - `gas/MaintenanceMode.js` (optional)
     - `gas/ExportRunService.js` (optional)
     - new/updated files under `tests/`
   - And no edits to Non-goals/freeze files.
   - Function boundary command exits `0` (no added/removed global function definitions in the two allowed GAS files).
4. [V4] Repository regression checks (must pass):
   - `node tests/test_csv_row_regression.js`
   - `npm run typecheck`
   - `npm test`
   - Pass criteria: all commands exit `0`.

## TDD Evidence Plan (required for `playbook: tdd-standard`)
- Red step (expected fail):
  - Command:
    - `node tests/test_maintenance_mode_operational_paths.js`
    - `node tests/test_export_run_service_operational_paths.js`
  - Expected result: non-zero exit before implementation (missing test files and/or failing initial assertions), with failure tied to AC-1/AC-2 coverage gaps.
- Green step (expected pass):
  - Command:
    - `node tests/test_maintenance_mode_operational_paths.js`
    - `node tests/test_export_run_service_operational_paths.js`
    - `node tests/test_csv_row_regression.js`
    - `npm run typecheck`
    - `npm test`
  - Expected result: all commands exit `0` with AC-1/AC-2 contract assertions passing.
- Waiver:
  - none

## Observability Plan (required for runtime behavior changes)
- Signals to capture:
  - Returned contract fields from target functions: `ok`, `reason`, `message`, `data`.
  - For export-run paths, include `data.run_id` and presence/shape checks for `data.report`, `data.export`, `data.clear`, `data.timing_ms`.
- Where signals are emitted:
  - `gas/MaintenanceMode.js` (`belle_maint_requireMode_`, `belle_maint_quiesceAndEnter_`, `belle_maint_exit_`)
  - `gas/ExportRunService.js` (`belle_export_run_maintenance_`)
- Correlation keys or dimensions:
  - `reason` code per branch, plus `run_id` for export-run failure/success correlation.
- Verification mapping:
  - V1 validates maintenance signals.
  - V2 validates export-run signals.
  - V4 ensures no broader regressions.
- Waiver:
  - Not applicable (existing return contracts are treated as observability signals).

## Safety / Rollback
- Failure modes:
  - Over-mocking that diverges from runtime contract.
  - Accidental changes to protected modules.
  - False positives from non-deterministic test setup.
- Mitigations:
  - Keep test fixtures minimal and deterministic (fixed time/random stubs).
  - Restrict runtime code edits to the two allowed GAS files only when tests prove necessity.
  - Run V3 boundary proof before finalizing.
- Rollback:
  - Revert changed files in this task scope (`gas/MaintenanceMode.js`, `gas/ExportRunService.js`, `tests/*` touched by this task).

## Implementation notes (optional)
- Suggested test files:
  - `tests/test_maintenance_mode_operational_paths.js`
  - `tests/test_export_run_service_operational_paths.js`
- Build VM sandboxes that stub GAS services directly in each test file; avoid editing shared freeze files for testability.
- Prefer asserting explicit reason codes and message strings where already stable in source.
