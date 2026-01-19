# PROJECT_STATE_SNAPSHOT_fallback_branch

## 1. Overview (pipeline stages)
- runner: belle_runPipelineBatch_v0 (Queue -> OCR only; no export)
- queue: belle_listFilesInFolder -> belle_queueFolderFilesToSheet -> belle_processQueueOnce
- export (manual): belle_exportYayoiCsvFallback / belle_exportYayoiCsvFromReview_test

## 2. Sheets (code-defined names and usage)
- OCR_RAW: default sheet name when no properties are set
- Queue sheet name resolution order:
  1) BELLE_QUEUE_SHEET_NAME
  2) BELLE_SHEET_NAME (legacy fallback)
  3) "OCR_RAW" (hard default)
- EXPORT_LOG: "EXPORT_LOG" (fixed name)
  - Note: legacy sheet name IMPORT_LOG must be renamed manually before export.
- EXPORT_SKIP_LOG: BELLE_SKIP_LOG_SHEET_NAME or "EXPORT_SKIP_LOG" (belle_getSkipLogSheetName)
- Output folder: BELLE_OUTPUT_FOLDER_ID or BELLE_DRIVE_FOLDER_ID (belle_getOutputFolderId)
- PERF_LOG: integrations sheet "PERF_LOG" when BELLE_INTEGRATIONS_SHEET_ID is set (optional)

## 3. Sheet headers
### Queue sheet (OCR_RAW / queue)
Header used by queue/ocr/export:
- status
- file_id
- file_name
- mime_type
- drive_url
- queued_at_iso
- ocr_json
- ocr_error
- ocr_attempts
- ocr_last_attempt_at_iso
- ocr_next_retry_at_iso
- ocr_error_code
- ocr_error_detail
- ocr_lock_owner
- ocr_lock_until_iso
- ocr_processing_started_at_iso
Notes:
- ocr_json is written only on successful OCR (valid JSON schema).
- errors are stored in ocr_error / ocr_error_detail and ocr_json is cleared on ERROR_RETRYABLE/ERROR_FINAL.

### EXPORT_LOG
- file_id
- exported_at_iso
- csv_file_id

### EXPORT_SKIP_LOG
- exported_at_iso
- file_id
- file_name
- reason

## 4. Status values and transitions (OCR_RAW)
- QUEUED -> DONE
- QUEUED -> ERROR_RETRYABLE -> DONE
- QUEUED -> ERROR_RETRYABLE -> ERROR_FINAL
- QUEUED -> ERROR_FINAL
- QUEUED -> PROCESSING -> DONE/ERROR_RETRYABLE/ERROR_FINAL (parallel worker claim)
- ERROR (legacy) is treated as ERROR_RETRYABLE

## 5. Entry points (belle_*)
### Primary (fallback-v0)
- belle_listFilesInFolder
- belle_queueFolderFilesToSheet
- belle_processQueueOnce
- belle_runPipelineBatch_v0
- belle_exportYayoiCsvFallback
- belle_exportYayoiCsvFromReview_test
- belle_ocr_workerTick_fallback_v0

### Debug / test
- belle_queueFolderFilesToSheet_test
- belle_processQueueOnce_test
- belle_runPipelineBatch_v0_test
- belle_ocr_claimNextRow_fallback_v0_test
- belle_ocr_workerLoop_fallback_v0_test
- belle_ocr_parallel_smoke_test
- belle_ocr_parallel_enable_fallback_v0_test
- belle_ocr_parallel_disable_fallback_v0_test
- belle_ocr_parallel_status_fallback_v0_test

### Deprecated (do not use)
- belle_healthCheck
- belle_setupScriptProperties
- belle_appendRow
- belle_appendRow_test
- belle_exportYayoiCsvFromReview (alias of fallback export)

## 6. Script Properties
Required:
- BELLE_SHEET_ID
- BELLE_DRIVE_FOLDER_ID
- BELLE_GEMINI_API_KEY
- BELLE_GEMINI_MODEL

Optional:
- BELLE_QUEUE_SHEET_NAME (preferred)
- BELLE_SHEET_NAME (legacy fallback)
- BELLE_OUTPUT_FOLDER_ID (default: BELLE_DRIVE_FOLDER_ID)
- BELLE_SKIP_LOG_SHEET_NAME (default: EXPORT_SKIP_LOG)
- BELLE_EXPORT_BATCH_MAX_ROWS (default: 5000)
- BELLE_CSV_ENCODING (default: SHIFT_JIS)
- BELLE_CSV_EOL (default: CRLF)
- BELLE_GEMINI_SLEEP_MS (default: 500)
- BELLE_MAX_ITEMS_PER_RUN (default: 1)
- BELLE_RUN_MAX_SECONDS (default: 240)
- BELLE_RUN_MAX_OCR_ITEMS_PER_BATCH (default: 5)
- BELLE_RUN_DO_QUEUE (default: true)
- BELLE_RUN_DO_OCR (default: true)
- BELLE_OCR_MAX_ATTEMPTS (default: 3)
- BELLE_OCR_RETRY_BACKOFF_SECONDS (default: 300)
- BELLE_OCR_LOCK_TTL_SECONDS (default: 300)
- BELLE_OCR_WORKER_MAX_ITEMS (default: 1)
- BELLE_OCR_CLAIM_SCAN_MAX_ROWS (default: 200)
- BELLE_OCR_CLAIM_CURSOR (auto-managed)
- BELLE_OCR_PARALLEL_ENABLED (default: false)
- BELLE_OCR_PARALLEL_WORKERS (default: 1)
- BELLE_OCR_PARALLEL_TRIGGER_TAG (default: BELLE_OCR_PARALLEL_V0)
- BELLE_INTEGRATIONS_SHEET_ID (optional; PERF_LOG)
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象夁E

## 7. Export guards (code facts)
- OCR_PENDING: queuedRemaining > 0
- OCR_RETRYABLE_REMAINING: errorRetryableCount > 0
- FISCAL_RANGE_NOT_CONFIGURED: fiscal dates missing or invalid format
- FISCAL_YEAR_MISMATCH: fiscal start/end years do not match
- Export targets: DONE + ERROR_FINAL (1 file = 1 row)
- EXPORT_LOG updates only when CSV is created

## 8. Runner phases and reasons
Phases:
- RUN_START
- RUN_GUARD (LOCK_BUSY)
- OCR_ITEM_START
- OCR_ITEM_DONE
- OCR_ITEM_ERROR
- RUN_STOP (TIME_BUDGET_EXCEEDED)
- RUN_SUMMARY

Reasons:
- LOCK_BUSY
- TIME_BUDGET_EXCEEDED
- NO_OCR_TARGETS
- OCR_NO_PROGRESS
- HIT_MAX_OCR_ITEMS_PER_BATCH
- NO_QUEUED_ITEMS
- ERROR:...

## 9. Known constraints (code facts)
- No SpreadsheetApp.getUi usage in gas/*.js.
- Review sheets (REVIEW_STATE/REVIEW_UI/REVIEW_LOG) are not referenced by code.

## 10. Memo format (V column)
- Order: FIX (optional) -> BELLE|FBK=1|RID -> DM (ERROR_FINAL only) -> DT (optional) -> FN (optional) -> ERR (optional) -> FID (always last)
- FN is sanitized (replace "|", remove newlines, trim)
