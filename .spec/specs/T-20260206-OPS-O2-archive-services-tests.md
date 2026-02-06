# T-20260206-OPS-O2: Archive services deterministic test coverage

## Meta
- id: T-20260206-OPS-O2
- owner_lane: consult -> implement
- risk: medium
- playbook: tdd-standard
- scope:
  - allow_edit:
    - gas/LogArchiveService.js
    - gas/ImageArchiveBatchService.js
    - gas/ArchiveNaming.js
    - tests/
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
- web_search: disabled
- decision_refs:
  - none

## Goal
Add deterministic Node-based regression tests for archive services so Implement lane can validate both success and failure contracts (especially `reason`, `message`, `data`) without external Drive/Spreadsheet dependencies. Keep production behavior unchanged unless a minimal testability seam is strictly required.

## Non-goals
- Do not edit `gas/Queue.js`, `gas/Export.js`, `gas/OcrWorkerParallel.js`, or any `gas/Dashboard*` files.
- Do not edit frozen shared files:
  - `gas/DocTypeRegistry.js`
  - `gas/Config.js`
  - `gas/Code.js`
  - `gas/ExportEntrypoints.js`
  - `gas/Log.js`
  - `tests/test_reset_headers.js`
  - `tests/test_doc_type_registry_callsite_smoke.js`
- Do not broaden this task into runtime feature changes, refactors outside archive services, or deployment work (`clasp deploy` is out of scope).

## Context / Constraints
- Primary runtime modules are GAS JavaScript files under `gas/`; tests run locally via Node + `vm` with mocked GAS globals.
- Existing conventions require ASCII-only comments in `gas/*.js`.
- Runtime behavior change intent: no (coverage-focused task).
- `ArchiveNaming` edits are allowed only if tests cannot be deterministic otherwise. Any such change must be minimal, backward-compatible, and explicitly justified in implementation/report notes.
- Implement lane must not edit `.spec/specs/`, `.agents/`, or `.lanes/`.

## Proposed approach
1. Add dedicated test files for `belle_logArchive_archiveLogs_` and `belle_image_archive_batch_run_` using deterministic mocks for `PropertiesService`, `DriveApp`, `SpreadsheetApp`, `Session`, `Utilities`, and time functions.
2. Cover both success and representative failure paths per service with explicit assertions on contract fields (`ok`, `reason`, `message`, `data`).
3. Keep test execution deterministic by stubbing time and generated names; avoid flaky assertions tied to wall-clock or external state.
4. If a service is not testable without production edits, apply the smallest possible seam in allowed files only, preserving external behavior.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] `tests/` includes deterministic coverage for `belle_logArchive_archiveLogs_` with:
   - at least one success case asserting `ok: true`, `reason: "OK"`, `message`, and key `data` fields (`archive_id`, `archive_name`, `folder_path`, `cleared`).
   - at least two failure cases asserting `ok: false` and exact `reason`/`message`, including one case that validates structured `data` (for example `LOG_SHEET_MISSING` or `ARCHIVE_COPY_FAILED`).
2. [AC-2] `tests/` includes deterministic coverage for `belle_image_archive_batch_run_` with:
   - at least one success case asserting `ok: true`, `reason: "OK"`, `message`, and key `data` fields (`moved_total`, `moved_by_doc_type`, `remaining`, `limit_hit`, `time_hit`, `missing_sources`, `elapsed_ms`).
   - at least two failure cases asserting `ok: false` and exact `reason`/`message`, including one case that validates structured `data` (for example `MOVE_FAILED` details or subfolder-create failure detail).
3. [AC-3] Added tests are deterministic and isolated:
   - no real Apps Script services are called,
   - all external dependencies are mocked/stubbed,
   - test assertions do not depend on nondeterministic timestamps.
4. [AC-4] If any production code changes are required for testability, they stay within allowed files and preserve existing runtime contracts:
   - no new reason codes unless required by spec update,
   - no behavioral change outside making tests deterministic,
   - any `gas/ArchiveNaming.js` change includes explicit justification in the implementation report.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V1, V3 | `node` test output shows all log-archive assertions pass; typecheck remains green. |
| AC-2 | V2, V3 | `node` test output shows all image-archive assertions pass; typecheck remains green. |
| AC-3 | V1, V2 | Test code uses stubs/mocks for GAS globals and deterministic time/name values; commands pass consistently. |
| AC-4 | V5, V6 | Scope boundary checks show no forbidden file edits; full suite remains green after optional minimal seams. |

## Verification
1. [V1] Log archive service tests:
   - Command: `node tests/test_log_archive_service.js`
   - Pass criteria: exit code `0`; output indicates success for all defined success/failure contract assertions.
2. [V2] Image archive batch service tests:
   - Command: `node tests/test_image_archive_batch_service.js`
   - Pass criteria: exit code `0`; output indicates success for all defined success/failure contract assertions.
3. [V3] Static/type safety:
   - Command: `npm run typecheck`
   - Pass criteria: exit code `0`; no new TypeScript `checkJs` errors.
4. [V4] Fast regression guard:
   - Command: `node tests/test_csv_row_regression.js`
   - Pass criteria: exit code `0`; baseline CSV regression remains unchanged.
5. [V5] Full regression sweep:
   - Command: `npm test`
   - Pass criteria: exit code `0`; no unrelated regression introduced.
6. [V6] Scope boundary check:
   - Command:
     1. `git diff --name-only -- gas/LogArchiveService.js gas/ImageArchiveBatchService.js gas/ArchiveNaming.js tests/`
     2. `git diff --name-only -- gas/Queue.js gas/Export.js gas/OcrWorkerParallel.js \"gas/Dashboard*.js\" gas/DocTypeRegistry.js gas/Config.js gas/Code.js gas/ExportEntrypoints.js gas/Log.js tests/test_reset_headers.js tests/test_doc_type_registry_callsite_smoke.js`
   - Pass criteria:
     - First command output is limited to allowed paths for this task.
     - Second command returns no file paths (forbidden files unchanged).

## TDD Evidence Plan (required for `playbook: tdd-standard`)
- Red step (expected fail):
  - Precondition: create/update target test files with AC-1/AC-2 assertions before any production-code seam changes.
  - Command:
    1. `node tests/test_log_archive_service.js`
    2. `node tests/test_image_archive_batch_service.js`
  - Expected result: non-zero exit from at least one command with assertion failure tied to unmet AC-1/AC-2 expectations.
- Green step (expected pass):
  - Command:
    1. `node tests/test_log_archive_service.js`
    2. `node tests/test_image_archive_batch_service.js`
    3. `npm run typecheck`
    4. `node tests/test_csv_row_regression.js`
    5. `npm test`
  - Expected result: all commands exit `0`; AC-1..AC-4 evidence captured in the report.
- Waiver:
  - Waiver: none

## Observability Plan
- Runtime behavior change intent: none (test-coverage task).
- Waiver: approved. No runtime signal or telemetry change is introduced; observability is satisfied by deterministic contract verification in V1/V2 and regression checks in V4/V5.
- Verification mapping: V1, V2, V4, V5.

## Safety / Rollback
- Potential failure mode: testability-driven code edits accidentally alter archive behavior.
- Mitigation:
  - Prefer test-only changes first.
  - Keep any production seam minimal and in allowed files only.
  - Run full verification steps V1-V5 before handoff.
- Rollback:
  1. Revert modified archive service files (if any) and newly added tests.
  2. Re-run `npm run typecheck` and `npm test` to confirm baseline restoration.

## Implementation notes (optional)
- Recommended test files:
  - `tests/test_log_archive_service.js`
  - `tests/test_image_archive_batch_service.js`
- Tests should load only required GAS modules into the VM context (for example `ArchiveNaming` + target service module) and provide explicit mocks for required globals.
- Prefer explicit assertions on full contract shape for failure cases (`reason`, `message`, `data`) to prevent silent behavior drift.
