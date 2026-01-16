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
5. Export guards:
   - OCR_PENDING (QUEUED remains)
   - OCR_RETRYABLE_REMAINING (ERROR_RETRYABLE remains)
6. Summary format: "merchant / item / registration_number" (no "/ fallback")
7. V-column memo includes BELLE/FBK/RID/FID (and ERR when available), FIX is prefix, URL is not used.
8. Tax rate inference priority:
   - tax_rate_printed
   - receipt_total_jpy + tax_total_jpy (tolerance 1 yen)
   - line_items description tax (内消費税等/うち消費税)
   - unknown -> RID=TAX_UNKNOWN or RID=MULTI_RATE

## 3. Runner (A plan)
- belle_runPipelineBatch_v0 runs queue -> OCR only.
- No review sheet generation.
- No export in runner.

## 4. Manual export
- Run belle_exportYayoiCsvFromReview_test or belle_exportYayoiCsvFallback from the editor.
- If QUEUED remains, it logs OCR_PENDING and does not create CSV or update IMPORT_LOG.
- If ERROR_RETRYABLE remains, it logs OCR_RETRYABLE_REMAINING and does not export.

## 5. Verification checklist (manual)
1) Run belle_runPipelineBatch_v0_test and check RUN_SUMMARY
2) With QUEUED remaining, run export and expect OCR_PENDING
3) After DONE/ERROR_FINAL only, export should create CSV and update IMPORT_LOG

## 6. References
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/SYSTEM_OVERVIEW_FALLBACK_V0.md
- docs/PLAN_FALLBACK_EXPORT_v0.md
- docs/DIFF_CHECKLIST_fallback_v0.md\n9. 8% tax kubun uses 軽減8% for 2019-10-01 and later (Yayoi Kaikei Next import format).\n