# CONFIG

## Script Properties (required)
These are required by the dashboard health check and maintenance workflows.
- BELLE_SHEET_ID
  - Main operational spreadsheet (queue + export/log sheets).
- BELLE_INTEGRATIONS_SHEET_ID
  - Used for PERF_LOG and dashboard audit logs.
- BELLE_DRIVE_FOLDER_ID
  - Input root folder. Files must be placed under subfolders: receipt, cc_statement, bank_statement.
  - Root-level files are skipped (logged to QUEUE_SKIP_LOG).
  - Multi-page/unknown-pagecount PDFs are skipped at queue time (QUEUE_SKIP_LOG reasons: MULTI_PAGE_PDF, PDF_PAGECOUNT_UNKNOWN).
- BELLE_LOG_ARCHIVE_FOLDER_ID
  - Archive root for export reports and log archives.
- BELLE_IMAGES_ARCHIVE_FOLDER_ID
  - Archive root for image archive batches.
- BELLE_GEMINI_API_KEY
- BELLE_GEMINI_MODEL
- BELLE_OUTPUT_FOLDER_ID
  - Output root for CSV exports (falls back to BELLE_DRIVE_FOLDER_ID in core export logic).
- BELLE_FISCAL_START_DATE (format: YYYY-MM-DD)
- BELLE_FISCAL_END_DATE (format: YYYY-MM-DD; same year as start)
  - Required for export; years must match and range must be valid.
- BELLE_OCR_MAX_ATTEMPTS (integer 1..10)
- BELLE_OCR_RETRY_BACKOFF_SECONDS (integer 0..86400)
- BELLE_EXPORT_BATCH_MAX_ROWS (integer 1..50000)

## Script Properties (optional)
- BELLE_QUEUE_SHEET_NAME (legacy receipt queue sheet override; default OCR_RECEIPT)
  - cc_statement and bank_statement use OCR_CC / OCR_BANK (no override).
  - Legacy override; normally not needed. Recommended to remove unless you intentionally override the receipt queue sheet name.
- BELLE_MAINTENANCE_TTL_MINUTES (default: 30)
- BELLE_ACTIVE_DOC_TYPES (comma-separated; default: receipt)
  - Allowed values: receipt, cc_statement, bank_statement
  - Include cc_statement to enable OCR_CC queue + OCR processing.
- BELLE_OCR_GENCFG_JSON__receipt__stage1 (optional; JSON string for generationConfig overrides)
- BELLE_OCR_GENCFG_JSON__bank_statement__stage1 (optional; JSON string for generationConfig overrides)
- BELLE_OCR_GENCFG_JSON__cc_statement__stage1 (optional; JSON string for generationConfig overrides)
- BELLE_OCR_GENCFG_JSON__cc_statement__stage2 (optional; JSON string for generationConfig overrides)
  - Example: {"temperature":0.2,"topP":0.5,"maxOutputTokens":512}
  - If temperature is omitted, default is 0.0.
- BELLE_CC_ENABLE_RESPONSE_JSON_SCHEMA (default: false)
- BELLE_CC_ENABLE_RESPONSE_MIME_TYPE (default: false)
  - Enable only if the model accepts responseMimeType/responseJsonSchema; invalid argument may return 400.
- BELLE_SKIP_LOG_SHEET_NAME (default: EXPORT_SKIP_LOG)
- BELLE_QUEUE_SKIP_LOG_SHEET_NAME (default: QUEUE_SKIP_LOG)
- BELLE_EXPORT_GUARD_LOG_SHEET_NAME (default: EXPORT_GUARD_LOG)
- BELLE_CSV_ENCODING (default: SHIFT_JIS)
- BELLE_CSV_EOL (default: CRLF)
- BELLE_GEMINI_SLEEP_MS (default: 500)
- BELLE_MAX_ITEMS_PER_RUN (default: 1)
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: 対象夁E)
  - The value must be a plain label (no extra description).
- BELLE_FALLBACK_APPEND_INVOICE_SUFFIX (default: true)
  - If false, do not append "適格" to tax kubun.
- BELLE_ERROR_FINAL_TEKIYO_LABEL (default: BELLE)
  - Applies to ERROR_FINAL dummy entries only.
- BELLE_RESET_TOKEN (admin-only)
  - Must match the expected token in code to run destructive reset.
- BELLE_CHATWORK_NOTIFY_ENABLED (default: false)
- BELLE_CHATWORK_API_TOKEN (required when enabled)
- BELLE_CHATWORK_ROOM_ID (required when enabled)
- BELLE_CHATWORK_WEBHOOK_ENABLED (default: false)
- BELLE_CHATWORK_WEBHOOK_TOKEN (URL token for webhook; set same value as ?token=...)
- BELLE_CHATWORK_WEBHOOK_ROUTE (default: chatwork)
### Parallel OCR
- BELLE_OCR_PARALLEL_ENABLED (boolean, default: false): enables parallel tick execution.
- BELLE_OCR_PARALLEL_WORKERS (number string, default: "1"): number of triggers to create (1-20).
- BELLE_OCR_PARALLEL_TRIGGER_TAG (string, default: "BELLE_OCR_PARALLEL_V0"): log tag for trigger management.
- BELLE_OCR_PARALLEL_TRIGGER_IDS (internal): auto-managed trigger IDs; do not edit.
- BELLE_OCR_PARALLEL_STAGGER_WINDOW_MS (number string, default: 50000): stagger window in ms (clamped to 0-59000).
- BELLE_OCR_LOCK_TTL_SECONDS (number string, default: 300): lock TTL for claim.
- BELLE_OCR_WORKER_MAX_ITEMS (number string, default: 1): max items per worker loop.
- BELLE_OCR_CLAIM_SCAN_MAX_ROWS (number string; unset = scan all rows).
- BELLE_OCR_CLAIM_CURSOR__<doc_type> (internal): auto-managed scan cursor; do not edit.
Notes:
- PERF_LOG v2 columns: logged_at_iso, phase, ok, doc_type, queue_sheet_name, last_reason, lock_busy_skipped, http_status, cc_error_code, cc_stage, cc_cache_hit, processing_count, detail_json.
- QUEUE_SKIP_LOG columns: logged_at_iso, phase, file_id, file_name, drive_url, doc_type, source_subfolder, reason, detail, first_seen_at_iso, last_seen_at_iso, seen_count.
- EXPORT_GUARD_LOG columns: logged_at_iso, phase, doc_type, queue_sheet_name, reason, counts_json, detail.
- Disable removes triggers only; BELLE_OCR_PARALLEL_ENABLED is unchanged.

## Notes
- cc_statement uses ocr_json as stage1 cache or stage2 final JSON.
- Review sheets (REVIEW_STATE/REVIEW_UI/REVIEW_LOG) are not used by the current pipeline.
- Queue sheets are split by doc_type: OCR_RECEIPT (receipt), OCR_CC (cc_statement), OCR_BANK (bank_statement).
- Queue sheet columns are extended (append-only): ocr_attempts, ocr_last_attempt_at_iso, ocr_next_retry_at_iso, ocr_error_code, ocr_error_detail.
- Export log sheet name is fixed: EXPORT_LOG (legacy IMPORT_LOG must be renamed manually).
- BELLE_LAST_EXPORT_RUN_AT_ISO was removed (no longer used).

## References
- docs/WORKFLOW.md
- docs/04_Yayoi_CSV_Spec_25cols.md
- docs/03_Tax_Determination_Spec.md
