# Refactor Control Board

Last updated: 2026-02-06
Program: project-wide refactoring (`belle_yayoi_pipeline_v0`)
Program lead (this board owner): Codex consult leader

## 1. Mission and Done Definition

Mission:
1. Decompose high-responsibility modules safely.
2. Expand deterministic test coverage for operational modules.
3. Preserve observability and strengthen end-to-end diagnosability.
4. Execute in parallel without active scope conflicts.

Program-level done definition:
1. All planned tracks have accepted specs and judged implementation reports.
2. Wave gates are passed (`node tests/test_csv_row_regression.js`, `npm run typecheck`, `npm test`).
3. No unresolved conflict incidents from overlapping active scopes.

## 2. Operating Rules

1. Single-writer lock: no active overlap in `scope.allow_edit` file paths.
2. Shared freeze files are integration-wave only:
- `gas/DocTypeRegistry.js`
- `gas/Config.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/Log.js`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`
3. One implement thread per spec in a fresh Codex thread.
4. Any blocker that can stop the program must be escalated immediately.

## 3. Wave Dashboard

| Wave | Objective | Tracks | Max parallel | Current status | Exit gate |
| --- | --- | --- | --- | --- | --- |
| Wave 0 | Spec backlog setup for first implementation wave | O1, O2, O3 | Consult: 3 | Completed (O1/O2/O3 reviewed) | 3 specs handoff-ready |
| Wave 1 | Operational module test expansion | O1, O2, O3 | Implement: 3 | Completed (O1/O2/O3 judged Accept; wave gate passed) | Per-spec judge accept + wave regression |
| Wave 2 | Core extraction with bounded overlap | C1, C2 | Implement: 2 | Consult launch ready (prompts prepared) | Per-spec judge accept + wave regression |
| Wave 3 | OCR worker decomposition | C3 | Implement: 1 | Not started | Per-spec judge accept + wave regression |
| Wave 4 | Dashboard decomposition + test helper extraction | U1, T1 | Implement: 2 | Not started | Per-spec judge accept + wave regression |
| Wave 5 | Correlation key normalization integration | X1 | Implement: 1 | Not started | Per-spec judge accept + wave regression |

## 4. Track Board

| Track | Goal | Primary editable scope | Consult prompt file | Target spec path | Status | Last update | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O1 | Add test-focused spec for maintenance/export-run services | `gas/MaintenanceMode.js`, `gas/ExportRunService.js`, `tests/` | `temp/refactor_control/session_prompts/wave0_consult_O1.md` | `.spec/specs/T-20260206-OPS-O1-maintenance-exportrun-tests.md` | Implement judged (Accept) | 2026-02-06 | Wave 1 completed for this track |
| O2 | Add test-focused spec for archive services | `gas/LogArchiveService.js`, `gas/ImageArchiveBatchService.js`, `gas/ArchiveNaming.js` (if needed), `tests/` | `temp/refactor_control/session_prompts/wave0_consult_O2.md` | `.spec/specs/T-20260206-OPS-O2-archive-services-tests.md` | Implement judged (Accept) | 2026-02-06 | Wave 1 completed for this track |
| O3 | Add server-side dashboard API test spec | `gas/DashboardApi.js`, `tests/` | `temp/refactor_control/session_prompts/wave0_consult_O3.md` | `.spec/specs/T-20260206-OPS-O3-dashboard-api-tests.md` | Implement judged (Accept) | 2026-02-06 | Wave 1 completed for this track |
| C1 | Export skeleton extraction spec | `gas/Export.js`, `tests/` | `temp/refactor_control/session_prompts/wave2_consult_C1.md` | `.spec/specs/T-20260206-CORE-C1-export-skeleton-extraction.md` | Consult prompt ready | 2026-02-06 | Launch Wave 2 C1 consult session |
| C2 | Queue claim/stale split spec | `gas/Queue.js`, `tests/` | `temp/refactor_control/session_prompts/wave2_consult_C2.md` | `.spec/specs/T-20260206-CORE-C2-queue-claim-stale-split.md` | Consult prompt ready | 2026-02-06 | Launch Wave 2 C2 consult session |
| C3 | OCR worker state split spec | `gas/OcrWorkerParallel.js`, `tests/` | - | `.spec/specs/T-20260206-CORE-C3-ocr-worker-state-split.md` | Waiting wave start | 2026-02-06 | Hold until Wave 2-3 |
| U1 | Dashboard script decomposition spec | `gas/Dashboard.html`, `tests/` | - | `.spec/specs/T-20260206-UI-U1-dashboard-script-decomposition.md` | Waiting wave start | 2026-02-06 | Hold until Wave 4 |
| T1 | Shared test helper extraction spec | `tests/` | - | `.spec/specs/T-20260206-TEST-T1-test-helper-library.md` | Waiting wave start | 2026-02-06 | Hold until Wave 4 |
| X1 | Correlation key normalization spec | multi-module integration scope | - | `.spec/specs/T-20260206-INTEG-X1-correlation-key-normalization.md` | Waiting wave start | 2026-02-06 | Hold until final wave |

## 5. Blocker Escalation Log

| Time | Severity | Blocker | Impact | Owner | Mitigation / Decision |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

## 6. Update Log

| Date | Update |
| --- | --- |
| 2026-02-06 | Created control board and prepared Wave 0 consult prompts for O1/O2/O3. |
| 2026-02-06 | Reviewed O1 spec (`T-20260206-OPS-O1`): accepted for implement handoff; no blocking gaps found. |
| 2026-02-06 | Reviewed O2 spec (`T-20260206-OPS-O2`): accepted for implement handoff; no blocking gaps found. |
| 2026-02-06 | Reviewed O3 spec (`T-20260206-OPS-O3`): accepted for implement handoff; no blocking gaps found. |
| 2026-02-06 | Wave 0 spec-prep objective completed; Wave 1 switched to ready state. |
| 2026-02-06 | Created Wave 1 implement prompts for O1/O2/O3 with explicit test-file ownership and `BLOCKER: SCOPE_CONFLICT` escalation rule. |
| 2026-02-06 | Judged O1 implementation (`T-20260206-OPS-O1`) as Accept after local verification rerun (targeted tests + boundary check + csv/typecheck/npm test). |
| 2026-02-06 | Judged O3 implementation (`T-20260206-OPS-O3`) as Accept after local verification rerun (targeted tests + boundary check + csv/typecheck/npm test). |
| 2026-02-06 | Judged O2 implementation (`T-20260206-OPS-O2`) as Accept after local verification rerun (targeted tests + boundary check + csv/typecheck/npm test). |
| 2026-02-06 | Wave 1 closed: O1/O2/O3 all accepted and wave-level verification passed. |
| 2026-02-06 | Prepared Wave 2 consult prompts for C1/C2 plus consult gatekeeper prompt; switched Wave 2 to consult-launch-ready. |
