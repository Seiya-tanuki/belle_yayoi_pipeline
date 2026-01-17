# CONFIG

## Script Properties (required)
- BELLE_SHEET_ID
- BELLE_DRIVE_FOLDER_ID
- BELLE_GEMINI_API_KEY
- BELLE_GEMINI_MODEL

## Script Properties (optional)
- BELLE_QUEUE_SHEET_NAME (preferred queue sheet)
- BELLE_SHEET_NAME (legacy fallback for queue sheet)
  - resolve order: BELLE_QUEUE_SHEET_NAME -> BELLE_SHEET_NAME -> OCR_RAW
  - using BELLE_SHEET_NAME logs CONFIG_WARN (BELLE_SHEET_NAME_DEPRECATED)
- BELLE_OUTPUT_FOLDER_ID (resolve order: BELLE_OUTPUT_FOLDER_ID -> BELLE_DRIVE_FOLDER_ID)
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
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象外)
  - The value must be a plain label (no extra description).
- BELLE_FALLBACK_APPEND_INVOICE_SUFFIX (default: true)
  - If false, do not append "適格" to tax kubun.
- BELLE_FISCAL_START_DATE (format: YYYY-MM-DD)
- BELLE_FISCAL_END_DATE (format: YYYY-MM-DD)
  - Required for export; years must match and range must be valid.
- BELLE_RESET_TOKEN (admin-only)
  - Must match the expected token in code to run destructive reset.
- BELLE_CHATWORK_NOTIFY_ENABLED (default: false)
- BELLE_CHATWORK_API_TOKEN (required when enabled)
- BELLE_CHATWORK_ROOM_ID (required when enabled)

## Notes
- Review sheets (REVIEW_STATE/REVIEW_UI/REVIEW_LOG) are not used in fallback-v0.
- OCR_RAW columns are extended (append-only): ocr_attempts, ocr_last_attempt_at_iso, ocr_next_retry_at_iso, ocr_error_code, ocr_error_detail.
- Export log sheet name is fixed: EXPORT_LOG (legacy IMPORT_LOG must be renamed manually).

## References
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/SYSTEM_OVERVIEW_FALLBACK_V0.md
- docs/PLAN_FALLBACK_EXPORT_v0.md



