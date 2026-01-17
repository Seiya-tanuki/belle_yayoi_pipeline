# WORKFLOW

## 1. Overview (fallback-v0)
- list: belle_listFilesInFolder
- queue: belle_queueFolderFilesToSheet
- ocr: belle_processQueueOnce (runner loops)
- export (manual): belle_exportYayoiCsvFallback (alias: belle_exportYayoiCsvFromReview_test)

## 2. Operation rules
1. dev Apps Script only. Do not push/deploy to prod/stg.
2. Sheets/Drive are append-only (no delete/clear).
3. Queue sheet name resolution order:
   1) BELLE_QUEUE_SHEET_NAME
   2) BELLE_SHEET_NAME (legacy fallback)
   3) OCR_RAW (hard default)
4. OCR status: QUEUED / DONE / ERROR_RETRYABLE / ERROR_FINAL.
5. OCR retry uses BELLE_OCR_MAX_ATTEMPTS and BELLE_OCR_RETRY_BACKOFF_SECONDS for ERROR_RETRYABLE.
6. Export guards:
   - OCR_PENDING (QUEUED remains)
   - OCR_RETRYABLE_REMAINING (ERROR_RETRYABLE remains)
7. Summary format: "merchant / registration_number" (item is not used). If regno is missing, use merchant only. Regno is never truncated. Optional trim: 120 Shift-JIS bytes, preserve regno.
8. V-column memo order: FIX (optional) -> BELLE|FBK=1|RID -> FN (optional) -> ERR (optional) -> FID (always last). FN is sanitized (replace "|", remove newlines, trim).
9. Tax rate inference priority:
   - tax_rate_printed
   - receipt_total_jpy + tax_total_jpy (tolerance 1 yen)
   - line_items description tax (内消費税等/うち消費税 etc)
   - unknown -> RID=TAX_UNKNOWN or RID=MULTI_RATE
10. 8% tax kubun uses "課対仕入込軽減8%" for 2019-10-01 and later (Yayoi Kaikei Next import format).
11. overall_issues with only MISSING_TAX_INFO is treated as benign when tax rate is already confirmed (no FIX).

## 3. Runner (A plan)
- belle_runPipelineBatch_v0 runs queue -> OCR only.
- No review sheet generation.
- No export in runner.

## 4. Manual export
- Run belle_exportYayoiCsvFromReview_test or belle_exportYayoiCsvFallback from the editor.
- If QUEUED remains, it logs OCR_PENDING and does not create CSV or update EXPORT_LOG.
- If ERROR_RETRYABLE remains, it logs OCR_RETRYABLE_REMAINING and does not export.
- Export log uses EXPORT_LOG (legacy IMPORT_LOG is auto-migrated on first export).

## 5. Verification checklist (manual)
1) Run belle_runPipelineBatch_v0_test and check RUN_SUMMARY
2) With QUEUED remaining, run export and expect OCR_PENDING
3) After DONE/ERROR_FINAL only, export should create CSV and update EXPORT_LOG
4) Case A (legacy): IMPORT_LOG exists and EXPORT_LOG missing -> export creates EXPORT_LOG by renaming or copying and preserves file_id dedupe
5) Case B (fresh): neither exists -> export creates EXPORT_LOG with header

## 6. References
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/SYSTEM_OVERVIEW_FALLBACK_V0.md
- docs/PLAN_FALLBACK_EXPORT_v0.md
- docs/DIFF_CHECKLIST_fallback_v0.md
