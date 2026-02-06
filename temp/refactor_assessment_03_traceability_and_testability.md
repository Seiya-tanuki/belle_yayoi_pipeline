# Refactoring Assessment - Error Traceability and Testability

Date: 2026-02-06

## 1. Scope
This document evaluates whether failures can be diagnosed by users/agents via tests and telemetry.

## 2. Existing Strengths (Keep and Extend)

### 2.1 Queue schema already carries root-cause fields
`gas/Queue.js` queue header includes:
- `ocr_error`
- `ocr_error_code`
- `ocr_error_detail`
- retry timing and attempts

Reference: `gas/Queue.js:16` to `gas/Queue.js:21`

This is a strong data-driven design base.

### 2.2 Structured log utilities with schema guard/rotation
`gas/Log.js` provides:
- Header guard and legacy rotation: `gas/Log.js:8` to `gas/Log.js:27`
- Export skip dedupe: `gas/Log.js:59` to `gas/Log.js:99`
- Queue skip dedupe + seen_count updates: `gas/Log.js:106` to `gas/Log.js:163`
- Export guard log row builder/appender: `gas/Log.js:170` to `gas/Log.js:193`

### 2.3 Good telemetry points in execution paths
- Export phase logs: `EXPORT_GUARD`/`EXPORT_DONE`/`EXPORT_ERROR` (`gas/Export.js`)
- Worker per-item logs: `OCR_WORKER_ITEM` (`gas/OcrWorkerParallel.js:368`)
- Queue item logs: `OCR_ITEM_START`/`OCR_ITEM_DONE`/`OCR_ITEM_ERROR` (`gas/Queue.js:577`, `gas/Queue.js:598`, `gas/Queue.js:659`)
- Trigger audit logs: `TRIGGER_AUDIT` (`gas/OcrParallelTrigger.js:44` to `gas/OcrParallelTrigger.js:53`)

## 3. Existing Test Evidence (Strong Areas)
The following tests directly protect observability contracts:

1. Invalid-schema detail truncation:
   - `tests/test_ocr_invalid_schema_log_detail.js:16` to `tests/test_ocr_invalid_schema_log_detail.js:22`
2. Perf log schema + row shape:
   - `tests/test_perf_log_v2.js:18` to `tests/test_perf_log_v2.js:50`
3. Perf log rotation:
   - `tests/test_perf_log_rotation.js:81` to `tests/test_perf_log_rotation.js:93`
4. Export log schema guard:
   - `tests/test_export_log_schema_guard.js:177` to `tests/test_export_log_schema_guard.js:231`
5. Export guard logging behavior:
   - `tests/test_export_guard_log.js:91` to `tests/test_export_guard_log.js:114`
6. Queue skip dedupe + counters:
   - `tests/test_queue_skip_log_dedupe.js:103` to `tests/test_queue_skip_log_dedupe.js:117`
7. Queue/export skip routing separation:
   - `tests/test_queue_skip_log_routing.js:104` to `tests/test_queue_skip_log_routing.js:117`
8. Webhook body capture/hash:
   - `tests/test_chatwork_webhook_body_capture.js:25` to `tests/test_chatwork_webhook_body_capture.js:45`
9. Webhook log rotation:
   - `tests/test_webhook_log_rotation.js:80` to `tests/test_webhook_log_rotation.js:94`
10. Trigger audit deletion filter:
   - `tests/test_trigger_audit_filter.js:58` to `tests/test_trigger_audit_filter.js:62`

## 4. Coverage Gaps (Important)

### 4.1 Zero direct test references
The following files had zero direct references in `tests/*.js` string-based loading:

- `gas/ArchiveNaming.js`
- `gas/DashboardApi.js`
- `gas/DashboardAuditLog.js`
- `gas/DashboardMaintenanceApi.js`
- `gas/DashboardWebApp.js`
- `gas/ExportRunService.js`
- `gas/ImageArchiveBatchService.js`
- `gas/LogArchiveService.js`
- `gas/MaintenanceMode.js`
- `gas/OcrPromptCcStatement.js`
- `gas/PropertiesMigrationPrint_v1.js`

Operationally, the high-risk subset is:
- Dashboard and maintenance control plane
- Export run service / archive services

### 4.2 Dashboard control plane is weakly protected
- `gas/DashboardApi.js` contains operation gates and environment checks, but no direct dedicated tests.
- `gas/DashboardWebApp.js` and `gas/Dashboard.html` are not covered by local harness.

This is risky because these files are user-facing recovery/operation paths.

### 4.3 Test harness duplication increases change cost
Approximate duplication indicators in `tests/`:
- `vm.createContext`: 72 occurrences
- local `MockSheet`/`MockSpreadsheet` class definitions repeated in many files
- repeated file load concatenation patterns

Impact:
- Harder to apply broad behavior updates in tests.
- Higher risk of inconsistent mocks vs real runtime behavior.

## 5. Traceability Gaps vs Three-Drive Intent
Against updated rules (spec traceability + observability):

1. There is good event logging, but correlation strategy is not uniform end-to-end.
   - Dashboard has RID (`gas/DashboardApi.js:5`), but queue/export/worker flows do not consistently carry a shared operation ID.
2. Most telemetry is sheet-append or Logger-based, but there is limited "join key" policy between:
   - queue row
   - worker result
   - export result
   - dashboard operation

Result:
- Root-cause investigation is usually possible, but often manual and multi-log.

## 6. Recommended Improvements

### 6.1 Add tests first for currently unprotected operational modules
Minimum first wave:
1. `MaintenanceMode.js`
2. `ExportRunService.js`
3. `LogArchiveService.js`
4. `ImageArchiveBatchService.js`
5. `DashboardApi.js` (server-side functions only)

### 6.2 Standardize correlation key policy
Define one operation correlation key and propagate through:
1. queue claim result
2. worker per-item logs
3. export guard/done logs
4. dashboard audit rows

### 6.3 Add test utility package for mocks
Create shared test helpers for:
1. mock spreadsheet/range
2. mock Drive folder/file
3. gas source loader composition

This lowers friction for new tests and improves consistency.

## 7. Judgement
Current traceability/testing is **better than average for GAS projects**, but **not yet sufficient** for stable AI-driven refactoring cycles under strict three-drive expectations.

Conclusion:
- Keep existing logging design.
- Prioritize operational-module tests and correlation normalization before large behavioral changes.

