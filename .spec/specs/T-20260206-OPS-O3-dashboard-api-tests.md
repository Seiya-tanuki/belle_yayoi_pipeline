# T-20260206-OPS-O3: Server-side Dashboard API contract and gating test coverage

## Meta
- id: T-20260206-OPS-O3
- owner_lane: consult -> implement
- risk: medium
- playbook: tdd-standard
- scope:
  - allow_edit:
    - gas/DashboardApi.js
    - tests/
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
- web_search: disabled
- decision_refs:
  - none

## Goal
Add deterministic server-side tests for `gas/DashboardApi.js` so success/failure branches and operation-mode gating are mechanically verified through Node VM tests. Keep runtime behavior contract-preserving and avoid any client/UI behavior change in this track.

## Non-goals
- No UI decomposition in this track; `gas/Dashboard.html` is out of scope.
- No edits to `gas/DashboardWebApp.js`, `gas/DashboardMaintenanceApi.js`, `gas/Queue.js`, `gas/Export.js`, `gas/OcrWorkerParallel.js`.
- No edits to shared freeze files:
  - `gas/DocTypeRegistry.js`
  - `gas/Config.js`
  - `gas/Code.js`
  - `gas/ExportEntrypoints.js`
  - `gas/Log.js`
  - `tests/test_reset_headers.js`
  - `tests/test_doc_type_registry_callsite_smoke.js`
- No new UI-facing API names, no response schema expansion beyond existing `DashboardApi` contracts.
- No deployment actions (`clasp deploy` prohibited; no `clasp push` in this task).

## Context / Constraints
- Primary runtime is GAS under `gas/`; tests run in Node under `tests/` using VM sandboxes.
- Determinism is required: no network access, no real Spreadsheet/Drive/Trigger services, and fixed stubs for time/random where assertions depend on them.
- `DashboardApi` response envelope is an existing contract surface via `belle_dash_wrap_`: `ok`, `rid`, `action`, `reason`, `message`, `data`.
- Operation gating relies on `belle_maint_requireMode_` and must keep reason/error semantics stable (for example `MODE_NOT_OCR`, `MODE_NOT_MAINTENANCE`, `OCR_ENABLE_BLOCKED`, `EXCEPTION`, `ENV_*`).
- Runtime behavior changes: no planned feature expansion; only minimal contract-preserving fixes in `gas/DashboardApi.js` are allowed if Red evidence reveals a defect.

## Proposed approach
1. Add focused Dashboard API contract tests for read/status endpoints and envelope/error handling branches.
2. Add focused Dashboard API operation-gating tests for OCR-only and MAINTENANCE-only operations, including blocked and success branches.
3. If tests reveal defects, apply minimal `gas/DashboardApi.js` fixes limited to contract preservation.
4. Run targeted tests first, then repository verification sequence.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] Deterministic tests cover server-side Dashboard API success/failure contract branches for read/status entrypoints, including at minimum:
   - `belle_dash_getOverview` and `belle_dash_getLogs` success shape (`ok/reason/message/data`) and deterministic mapped data fields.
   - environment failure branches (`ENV_CHECK_MISSING`, `ENV_CHECK_FAILED`, `ENV_NOT_READY`) and missing sheet-id failure (`MISSING_SHEET_ID`) where applicable.
   - wrapper exception handling branch (`EXCEPTION`) through `belle_dash_wrap_`.
2. [AC-2] Deterministic tests cover operation-mode gating and operation result handling, including at minimum:
   - OCR-mode operations (`belle_dash_opQueue`, `belle_dash_opOcrEnable`, `belle_dash_opOcrDisable`, `belle_dash_enterMaintenance`) when mode gate fails.
   - MAINTENANCE-mode operations (`belle_dash_opExport`, `belle_dash_archiveLogs`, `belle_dash_archiveImages`, `belle_dash_exportRun`) when mode gate fails.
   - operation success paths for `belle_dash_opQueue` and `belle_dash_exportRun`, plus `belle_dash_opOcrEnable` blocked branch returning `OCR_ENABLE_BLOCKED` with critical `data.reason` and `data.requested` assertions.
3. [AC-3] For covered paths, tests assert response shape contracts and critical reason/error fields (`reason`, `message`, `data`, and envelope fields `rid`/`action`), and implementation changes remain within allowed scope with no UI-facing behavior changes.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V1, V3 | Targeted contract test output shows deterministic assertions for read/status success and failure reasons (`ENV_*`, `MISSING_SHEET_ID`, `EXCEPTION`) with envelope shape checks. |
| AC-2 | V2, V3 | Targeted gating test output shows deterministic pass for OCR vs MAINTENANCE gate outcomes and `OCR_ENABLE_BLOCKED` payload assertions. |
| AC-3 | V1, V2, V3, V4 | Test logs prove reason/message/data and envelope assertions; diff scope proof shows boundaries; regression commands confirm no unintended breakage. |

## Verification
1. [V1] Dashboard API contract-path tests (must pass in Green):
   - `node tests/test_dashboard_api_contract_paths.js`
   - Pass criteria: exit code `0`; output includes terminal OK line (for example `OK: test_dashboard_api_contract_paths`); assertions verify envelope fields and failure reasons for AC-1 branches.
2. [V2] Dashboard API operation-gating tests (must pass in Green):
   - `node tests/test_dashboard_api_operation_gates.js`
   - Pass criteria: exit code `0`; output includes terminal OK line (for example `OK: test_dashboard_api_operation_gates`); assertions verify gate behavior and critical blocked/success payload fields for AC-2.
3. [V3] Scope/boundary proof (must pass):
   - `git diff --name-only`
   - Pass criteria: changed files are limited to:
     - `gas/DashboardApi.js` (optional)
     - new/updated files under `tests/`
   - And no edits to Non-goals/freeze files.
4. [V4] Repository regression checks (must pass):
   - `node tests/test_csv_row_regression.js`
   - `npm run typecheck`
   - `npm test`
   - Pass criteria: all commands exit `0`.

## TDD Evidence Plan (required for `playbook: tdd-standard`)
- Red step (expected fail):
  - Command:
    - `node tests/test_dashboard_api_contract_paths.js`
    - `node tests/test_dashboard_api_operation_gates.js`
  - Expected result: non-zero exit before implementation is complete (missing test files and/or initial failing assertions), with failures tied to AC-1/AC-2 coverage gaps.
- Green step (expected pass):
  - Command:
    - `node tests/test_dashboard_api_contract_paths.js`
    - `node tests/test_dashboard_api_operation_gates.js`
    - `node tests/test_csv_row_regression.js`
    - `npm run typecheck`
    - `npm test`
  - Expected result: all commands exit `0` with AC-1/AC-2 contract and gating assertions passing.
- Waiver:
  - none

## Observability Plan (required for runtime behavior changes)
- Signals to capture:
  - Dashboard API response envelope fields: `ok`, `rid`, `action`, `reason`, `message`, `data`.
  - Gating/error reason codes: `ENV_CHECK_MISSING`, `ENV_CHECK_FAILED`, `ENV_NOT_READY`, `MISSING_SHEET_ID`, `MODE_NOT_OCR`, `MODE_NOT_MAINTENANCE`, `OCR_ENABLE_BLOCKED`, `EXCEPTION`.
- Where signals are emitted:
  - `gas/DashboardApi.js` via `belle_dash_wrap_` and operation/read entrypoints.
- Correlation keys or dimensions:
  - `rid` and `action` per invocation, paired with `reason` for branch-level traceability.
- Verification mapping:
  - V1 validates read/status and envelope/failure signals.
  - V2 validates operation-gating and blocked/success signals.
  - V4 validates no wider regressions after coverage additions.
- Waiver:
  - Not applicable (existing response contracts are used as observability signals).

## Safety / Rollback
- Failure modes:
  - Overly permissive mocks masking real branch behavior.
  - Accidental edits outside allowed scope.
  - Brittle assertions tied to unstable text rather than stable reason codes.
- Mitigations:
  - Prefer assertions on stable reason codes and key data fields; only assert full message strings where clearly stable.
  - Keep stubs deterministic and local to each test file.
  - Run V3 scope proof before finalizing.
- Rollback:
  - Revert touched files in this task scope (`gas/DashboardApi.js` if changed, and `tests/*` files added/updated by this task).

## Implementation notes (optional)
- Suggested new tests:
  - `tests/test_dashboard_api_contract_paths.js`
  - `tests/test_dashboard_api_operation_gates.js`
- Use per-test VM sandboxes with explicit stubs for `SpreadsheetApp`, `ScriptApp`, and Dashboard dependencies to isolate each branch deterministically.
- Prefer branch-focused fixtures over end-to-end UI simulation; this track is server-side API only.
