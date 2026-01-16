# SYSTEM_OVERVIEW_FALLBACK_V0

## Goal
- Always produce 1 CSV row per file (fallback export), even when OCR is incomplete.
- Prevent accidental export when OCR is not finished (guarded by OCR_PENDING / OCR_RETRYABLE_REMAINING).

## Pipeline
1) List + Queue
- belle_listFilesInFolder: list files in Drive folder
- belle_queueFolderFilesToSheet: append rows to OCR_RAW (queue sheet)

2) OCR
- belle_processQueueOnce: process QUEUED or ERROR_RETRYABLE rows
- status transitions: QUEUED -> DONE, QUEUED -> ERROR_RETRYABLE -> DONE/ERROR_FINAL

3) Export (manual only)
- belle_exportYayoiCsvFromReview / _test
- Reads OCR_RAW and generates CSV (1 file = 1 row)
- Guards:
  - OCR_PENDING if QUEUED exists
  - OCR_RETRYABLE_REMAINING if ERROR_RETRYABLE exists

## Sheet roles (who edits)
- OCR_RAW: system-only (queue + OCR output)
- IMPORT_LOG: system-only (dedupe and audit)
- EXPORT_SKIP_LOG: system-only (skipped reasons)
- Review sheets are not used in fallback-v0.

## OCR_RAW schema (latest)
status, file_id, file_name, mime_type, drive_url, queued_at_iso, ocr_json, ocr_error,
ocr_attempts, ocr_last_attempt_at_iso, ocr_next_retry_at_iso, ocr_error_code, ocr_error_detail

## Export rules (fallback)
- Output targets: DONE + ERROR_FINAL
- 1 file = 1 row (no multi-rate split)
- Debit/credit default: 借方=仮払金, 貸方=現金 (built in belle_yayoi_buildRow)
- Debit tax default: BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象外)

## Memo format (V column)
- Always includes: BELLE|FBK=1|RID=...|FID=...
- Optional: URL=..., FIX=..., ERR=...
- Trim rule: Shift-JIS 180 bytes, drop FIX first, then URL, keep BELLE/FBK/RID/FID/ERR

## Runner (time trigger)
- belle_runPipelineBatch_v0 = Queue + OCR only (no export)
- Guard: LOCK_BUSY if ScriptLock not available
- Graceful stop: TIME_BUDGET_EXCEEDED

## Script Properties (high impact)
- BELLE_OCR_MAX_ATTEMPTS (default: 3)
- BELLE_OCR_RETRY_BACKOFF_SECONDS (default: 300)
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象外)

## Restart checklist (quick)
1) Run belle_runPipelineBatch_v0_test -> check RUN_SUMMARY
2) Run export with QUEUED remaining -> OCR_PENDING guard
3) After DONE/ERROR_FINAL only -> export generates CSV and updates IMPORT_LOG

## References
- docs/WORKFLOW.md
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md