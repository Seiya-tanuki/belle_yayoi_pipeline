# WORKFLOW

## 1. Overview (fallback-v0)
- list: belle_listFilesInFolder
- queue: belle_queueFolderFilesToSheet
- ocr: belle_processQueueOnce (runner loops)
- export (manual): belle_exportYayoiCsvFromReview_test (1 file = 1 row fallback)

## 2. Operation rules
1. dev Apps Script only. Do not push/deploy to prod/stg.
2. Sheets/Drive are append-only (no delete/clear).
3. Queue sheet name: BELLE_QUEUE_SHEET_NAME or BELLE_SHEET_NAME (default OCR_RAW).
4. OCR status: QUEUED / DONE / ERROR_RETRYABLE / ERROR_FINAL.
5. Export runs only after OCR is done. If QUEUED or ERROR_RETRYABLE remains, export is guarded (OCR_PENDING / OCR_RETRYABLE_REMAINING).
6. V-column memo always includes BELLE/FBK/RID/FID (and ERR when available) and is trimmed to 180 bytes (Shift-JIS).

## 3. Runner (A plan)
- belle_runPipelineBatch_v0 runs queue -> OCR only.
- No review sheet generation.
- No export in runner.

## 4. Manual export
- Run belle_exportYayoiCsvFromReview_test from the editor.
- If QUEUED remains, it logs OCR_PENDING and does not create CSV or update IMPORT_LOG.
- If ERROR_RETRYABLE remains, it logs OCR_RETRYABLE_REMAINING and does not export.

## 5. Verification checklist (manual)
A. Delete REVIEW_STATE/REVIEW_UI/REVIEW_LOG if they exist.
B. Run belle_runPipelineBatch_v0_test and confirm:
   - REVIEW_* sheets are not created
   - OCR_RAW status moves to DONE/ERROR_* (up to 5 items)
   - summary has no reviewAdded field
C. With QUEUED remaining, run belle_exportYayoiCsvFromReview_test and confirm:
   - OCR_PENDING guard
   - no CSV file and no IMPORT_LOG update
D. After OCR settles (no QUEUED/ERROR_RETRYABLE), run export and confirm:
   - DONE + ERROR_FINAL are exported (1 file = 1 row)
   - V-column memo includes BELLE/FBK/RID/FID/ERR and is <= 180 bytes

## 6. References
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/PLAN_FALLBACK_EXPORT_v0.md
- docs/DIFF_CHECKLIST_fallback_v0.md