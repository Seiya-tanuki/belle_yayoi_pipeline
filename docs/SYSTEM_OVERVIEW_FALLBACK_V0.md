# SYSTEM_OVERVIEW_FALLBACK_V0

NOTE: This document is historical; see WORKFLOW.md for current behavior.

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
- invalid/empty OCR responses are treated as retryable and stored in error columns (not ocr_json)
- parallel OCR mode (worker tick):
  - claim sets status=PROCESSING and lock columns (ocr_lock_owner, ocr_lock_until_iso)
  - Gemini runs outside ScriptLock
  - writeback requires owner match and clears lock columns
  - stale PROCESSING is reaped to ERROR_RETRYABLE (WORKER_STALE_LOCK)
  - PERF_LOG is written to integrations sheet when BELLE_INTEGRATIONS_SHEET_ID is set

3) Export (manual only)
- belle_exportYayoiCsvFallback (primary)
- belle_exportYayoiCsvFromReview is a deprecated alias
- Guards:
  - OCR_PENDING if QUEUED exists
  - OCR_RETRYABLE_REMAINING if ERROR_RETRYABLE exists

## Sheet roles (who edits)
- OCR_RAW: system-only (queue + OCR output)
- EXPORT_LOG: system-only (dedupe and audit)
  - Note: legacy sheet name IMPORT_LOG must be renamed manually before export.
- EXPORT_SKIP_LOG: system-only (skipped reasons)
- PERF_LOG (integrations sheet): system-only (OCR worker metrics; optional)
- Review sheets are not used in fallback-v0.

## Queue sheet name resolution order
1) BELLE_QUEUE_SHEET_NAME
2) BELLE_SHEET_NAME (legacy fallback; CONFIG_WARN)
3) OCR_RAW (hard default)

## Log/output resolution
- Export log: EXPORT_LOG (legacy IMPORT_LOG must be renamed manually)
- Skip log: BELLE_SKIP_LOG_SHEET_NAME or EXPORT_SKIP_LOG
- Output folder: BELLE_OUTPUT_FOLDER_ID or BELLE_DRIVE_FOLDER_ID

## OCR_RAW schema (latest)
status, file_id, file_name, mime_type, drive_url, queued_at_iso, ocr_json, ocr_error,
ocr_attempts, ocr_last_attempt_at_iso, ocr_next_retry_at_iso, ocr_error_code, ocr_error_detail,
ocr_lock_owner, ocr_lock_until_iso, ocr_processing_started_at_iso
Notes:
- ocr_json is written only on successful OCR (valid JSON schema).
- errors are stored in ocr_error / ocr_error_detail, and ocr_json is cleared for ERROR_RETRYABLE/ERROR_FINAL.
- lock columns are used by parallel OCR workers; stale locks are reaped back to ERROR_RETRYABLE.

## Export rules (fallback)
- Output targets: DONE + ERROR_FINAL
- 1 file = 1 row (no multi-rate split)
- Debit/credit default: 借方=仮払��, 貸方=現釁E(belle_yayoi_buildRow)
- Debit tax default: BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象夁E

## Summary (摘要E
- Format: "merchant / registration_number"
- merchant missing -> "BELLE"
- item is not used
- registration_number is full "T+13 digits" and never truncated
- If too long, merchant is trimmed to preserve registration_number (Shift-JIS 120 bytes)

## Memo format (V column)
- Order: FIX (optional) -> BELLE|FBK=1|RID -> DM (ERROR_FINAL only) -> DT (optional) -> FN (optional) -> ERR (optional) -> FID (always last)
- FN is sanitized (replace "|", remove newlines, trim)
- Trim rule: Shift-JIS 180 bytes, keep FIX + RID + DT + FN + ERR + FID in that order

## Date fallback (export)
- Requires BELLE_FISCAL_START_DATE and BELLE_FISCAL_END_DATE (same year, YYYY-MM-DD).
- No/invalid date -> use fiscal end, RID=DATE_FALLBACK, DT=NO_DATE, FIX=誤った取引日.
- Out of range -> replace year with fiscal year, DT=OUT_OF_RANGE.
- Leap invalid after replace -> use fiscal end, DT=LEAP_ADJUST.
- Do not use file_name or queued_at_iso for date fallback.

## Tax rate inference (fallback)
Priority:
1) tax_meta.tax_rate_printed
2) receipt_total_jpy + tax_total_jpy (tolerance 1 yen)
3) line_items description with tax amount (冁E��費税筁EぁE��消費稁Eetc)
4) unknown (RID=TAX_UNKNOWN or RID=MULTI_RATE)
Note: overall_issues with only MISSING_TAX_INFO is treated as benign when tax rate is already confirmed (no FIX).

## 8% tax kubun (official wording)
- From 2019-10-01 and later, 8% should use "課対仕�E込軽渁E%" in tax kubun notation.
- Source: Yayoi Kaikei Next import format (tax kubun) lists 8% reduced as "軽渁E%".
- Invoice suffix (適格) can be appended, but may be disabled via BELLE_FALLBACK_APPEND_INVOICE_SUFFIX.

## Script Properties (high impact)
- BELLE_OCR_MAX_ATTEMPTS (default: 3)
- BELLE_OCR_RETRY_BACKOFF_SECONDS (default: 300)
- BELLE_OCR_LOCK_TTL_SECONDS (default: 300)
- BELLE_OCR_WORKER_MAX_ITEMS (default: 1)
- BELLE_OCR_CLAIM_SCAN_MAX_ROWS (default: 200)
- BELLE_OCR_CLAIM_CURSOR (auto-managed)
- BELLE_OCR_PARALLEL_TRIGGER_IDS (auto-managed)
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象夁E

## Deprecated entrypoints
- belle_healthCheck
- belle_setupScriptProperties
- belle_appendRow
- belle_exportYayoiCsvFromReview (alias of fallback export)

## Restart checklist (quick)
2) Run export with QUEUED remaining -> OCR_PENDING guard
3) After DONE/ERROR_FINAL only -> export generates CSV and updates EXPORT_LOG

## References
- docs/WORKFLOW.md
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/legacy/SYSTEM_OVERVIEW_REVIEW_SHEET_V0.md (legacy)
