# RESET_GUIDE_fallback_v0

## Purpose
This reset is destructive. It deletes and recreates OCR/queue and EXPORT_LOG sheets.
Use only when headers/sheet names are corrupted.

## Prerequisites
- You must be an administrator of the spreadsheet.
- This action deletes existing data in the managed sheets.
- If parallel OCR triggers are enabled, disable them before reset (belle_ocr_parallel_disable_fallback_v0_test).

## Token Guard
- Set Script Property `BELLE_RESET_TOKEN` to the expected value.
- Expected token:
  - `RESET_FALLBACK_V0_CONFIRM`

## Execution Steps
1) Open Script Properties and set `BELLE_RESET_TOKEN` to the expected token.
2) Run `belle_resetSpreadsheetToInitialState_fallback_v0_test` in the Apps Script editor.
3) Confirm logs show `RESET_DONE` and that `BELLE_RESET_TOKEN` is cleared.

## What gets deleted
- Queue/OCR sheet (resolved by `belle_getQueueSheetName`)
- EXPORT_LOG
- Known legacy sheets: OCR_RAW, QUEUE, IMPORT_LOG, REVIEW_UI, REVIEW_STATE, REVIEW_LOG

## What gets recreated
- Queue/OCR sheet with header:
  - status, file_id, file_name, mime_type, drive_url, queued_at_iso, ocr_json, ocr_error,
    ocr_attempts, ocr_last_attempt_at_iso, ocr_next_retry_at_iso, ocr_error_code, ocr_error_detail, ocr_lock_owner, ocr_lock_until_iso, ocr_processing_started_at_iso
- EXPORT_LOG with header:
  - file_id, exported_at_iso, csv_file_id

## Guards and logs
- Token mismatch: `RESET_GUARD` / `RESET_TOKEN_MISMATCH`
- Lock busy: `RESET_GUARD` / `LOCK_BUSY`
- Missing BELLE_SHEET_ID: `RESET_GUARD` / `MISSING_SHEET_ID`
