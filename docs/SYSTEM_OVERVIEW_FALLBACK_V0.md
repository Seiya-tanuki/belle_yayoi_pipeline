# SYSTEM_OVERVIEW_FALLBACK_V0

## Goal
- Always produce 1 CSV row per file (fallback export).
- Prevent export when OCR is not finished (guards in export).

## Pipeline
1) List + Queue
- belle_listFilesInFolder: list files in Drive folder
- belle_queueFolderFilesToSheet: append rows to OCR_RAW (queue sheet)

2) OCR
- belle_processQueueOnce: process QUEUED or ERROR_RETRYABLE rows
- status transitions: QUEUED -> DONE, QUEUED -> ERROR_RETRYABLE -> DONE/ERROR_FINAL

3) Export (manual only)
- belle_exportYayoiCsvFallback (primary)
- belle_exportYayoiCsvFromReview is a deprecated alias
- Guards:
  - OCR_PENDING if QUEUED exists
  - OCR_RETRYABLE_REMAINING if ERROR_RETRYABLE exists

## Sheet roles (who edits)
- OCR_RAW: system-only (queue + OCR output)
- IMPORT_LOG: system-only (dedupe and audit)
- EXPORT_SKIP_LOG: system-only (skipped reasons)
- Review sheets are not used in fallback-v0.

## Queue sheet name resolution order
1) BELLE_QUEUE_SHEET_NAME
2) BELLE_SHEET_NAME (legacy fallback; CONFIG_WARN)
3) OCR_RAW (hard default)

## Log/output resolution
- Import log: BELLE_IMPORT_LOG_SHEET_NAME or IMPORT_LOG
- Skip log: BELLE_SKIP_LOG_SHEET_NAME or EXPORT_SKIP_LOG
- Output folder: BELLE_OUTPUT_FOLDER_ID or BELLE_DRIVE_FOLDER_ID

## OCR_RAW schema (latest)
status, file_id, file_name, mime_type, drive_url, queued_at_iso, ocr_json, ocr_error,
ocr_attempts, ocr_last_attempt_at_iso, ocr_next_retry_at_iso, ocr_error_code, ocr_error_detail

## Export rules (fallback)
- Output targets: DONE + ERROR_FINAL
- 1 file = 1 row (no multi-rate split)
- Debit/credit default: 借方=仮払金, 貸方=現金 (belle_yayoi_buildRow)
- Debit tax default: BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象外)

## Summary (摘要)
- Format: "merchant / registration_number"
- merchant missing -> "BELLE"
- item is not used
- registration_number is full "T+13 digits" and never truncated
- If too long, merchant is trimmed to preserve registration_number (Shift-JIS 120 bytes)

## Memo format (V column)
- Always includes: BELLE|FBK=1|RID=...|FID=...
- Optional: FIX=... (prefix), ERR=...
- URL is not included
- Trim rule: Shift-JIS 180 bytes, keep FIX + BELLE/FBK/RID/FID/ERR in that order

## Tax rate inference (fallback)
Priority:
1) tax_meta.tax_rate_printed
2) receipt_total_jpy + tax_total_jpy (tolerance 1 yen)
3) line_items description with tax amount (内消費税等/うち消費税 etc)
4) unknown (RID=TAX_UNKNOWN or RID=MULTI_RATE)
Note: overall_issues with only MISSING_TAX_INFO is treated as benign when tax rate is already confirmed (no FIX).

## 8% tax kubun (official wording)
- From 2019-10-01 and later, 8% should use "課対仕入込軽減8%" in tax kubun notation.
- Source: Yayoi Kaikei Next import format (tax kubun) lists 8% reduced as "軽減8%".
- Invoice suffix (適格) can be appended, but may be disabled via BELLE_FALLBACK_APPEND_INVOICE_SUFFIX.

## Runner (time trigger)
- belle_runPipelineBatch_v0 = Queue + OCR only (no export)
- Guard: LOCK_BUSY if ScriptLock not available
- Graceful stop: TIME_BUDGET_EXCEEDED

## Script Properties (high impact)
- BELLE_OCR_MAX_ATTEMPTS (default: 3)
- BELLE_OCR_RETRY_BACKOFF_SECONDS (default: 300)
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象外)

## Deprecated entrypoints
- belle_healthCheck
- belle_setupScriptProperties
- belle_appendRow
- belle_appendRow_test
- belle_exportYayoiCsvFromReview (alias of fallback export)

## Restart checklist (quick)
1) Run belle_runPipelineBatch_v0_test -> check RUN_SUMMARY
2) Run export with QUEUED remaining -> OCR_PENDING guard
3) After DONE/ERROR_FINAL only -> export generates CSV and updates IMPORT_LOG

## References
- docs/WORKFLOW.md
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/legacy/SYSTEM_OVERVIEW_REVIEW_SHEET_V0.md (legacy)
