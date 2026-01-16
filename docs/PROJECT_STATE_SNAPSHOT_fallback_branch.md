# PROJECT_STATE_SNAPSHOT_fallback_branch

## 1. Overview (pipeline stages)
- list: belle_listFilesInFolder (gas/Code.js)
- queue: belle_queueFolderFilesToSheet (gas/Code.js)
- ocr: belle_processQueueOnce (gas/Code.js)
- export: belle_exportYayoiCsvFromReview (gas/Review_v0.js)
- runner: belle_runPipelineBatch_v0 (gas/Code.js)

## 2. Sheets (code-defined names and usage)
- OCR_RAW: default sheet name for belle_appendRow (gas/Code.js)
- Queue sheet: BELLE_QUEUE_SHEET_NAME or BELLE_SHEET_NAME (gas/Code.js, gas/Review_v0.js)
- IMPORT_LOG: default name "IMPORT_LOG" (gas/Review_v0.js, gas/Code.js)
- EXPORT_SKIP_LOG: default name "EXPORT_SKIP_LOG" (gas/Review_v0.js, gas/Code.js)

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

### IMPORT_LOG
- file_id
- exported_at_iso
- csv_file_id

### EXPORT_SKIP_LOG
- exported_at_iso
- file_id
- file_name
- reason

## 4. Entry point functions (belle_*)
- gas/Code.js
  - belle_healthCheck
  - belle_setupScriptProperties
  - belle_appendRow
  - belle_appendRow_test
  - belle_listFilesInFolder
  - belle_queueFolderFilesToSheet
  - belle_queueFolderFilesToSheet_test
  - belle_getGeminiConfig
  - belle_callGeminiOcr
  - belle_processQueueOnce
  - belle_processQueueOnce_test
  - belle_appendSkipLogRows
  - belle_exportYayoiCsvFromDoneRows
  - belle_exportYayoiCsvFromDoneRows_test
  - belle_exportYayoiCsvFromDoneRows_force_test
  - belle_parseBool
  - belle_runPipelineBatch_v0
  - belle_runPipelineBatch_v0_test
- gas/Review_v0.js
  - belle_exportYayoiCsvFromReview
  - belle_exportYayoiCsvFromReview_test

## 5. Script Properties
Required:
- BELLE_SHEET_ID
- BELLE_DRIVE_FOLDER_ID
- BELLE_GEMINI_API_KEY
- BELLE_GEMINI_MODEL

Optional:
- BELLE_SHEET_NAME (default sheet name for appendRow; code default: OCR_RAW)
- BELLE_QUEUE_SHEET_NAME (default: BELLE_SHEET_NAME)
- BELLE_OUTPUT_FOLDER_ID (default: BELLE_DRIVE_FOLDER_ID)
- BELLE_IMPORT_LOG_SHEET_NAME (default: IMPORT_LOG)
- BELLE_SKIP_LOG_SHEET_NAME (default: EXPORT_SKIP_LOG)
- BELLE_EXPORT_BATCH_MAX_ROWS (default: 5000)
- BELLE_CSV_ENCODING (default: SHIFT_JIS)
- BELLE_CSV_EOL (default: CRLF)
- BELLE_INVOICE_SUFFIX_MODE (default: OFF)
- BELLE_GEMINI_SLEEP_MS (default: 500)
- BELLE_MAX_ITEMS_PER_RUN (default: 1)
- BELLE_RUN_MAX_SECONDS (default: 240)
- BELLE_RUN_MAX_OCR_ITEMS_PER_BATCH (default: 5)
- BELLE_RUN_DO_QUEUE (default: true)
- BELLE_RUN_DO_OCR (default: true)
- BELLE_OCR_MAX_ATTEMPTS (default: 3)
- BELLE_OCR_RETRY_BACKOFF_SECONDS (default: 300)
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象外)

## 6. Known constraints (code facts)
- No SpreadsheetApp.getUi usage in gas/*.js.
- Review sheets (REVIEW_STATE/REVIEW_UI/REVIEW_LOG) are not referenced by code.