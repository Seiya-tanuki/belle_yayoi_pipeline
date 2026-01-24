# CONFIG

## Script Properties (required)
- BELLE_SHEET_ID
- BELLE_DRIVE_FOLDER_ID
  - Input root folder. Files must be placed under subfolders: receipt, cc_statement, bank_statement.
  - Root-level files are skipped (logged to QUEUE_SKIP_LOG).
  - Multi-page/unknown-pagecount PDFs are skipped at queue time (QUEUE_SKIP_LOG reasons: MULTI_PAGE_PDF, PDF_PAGECOUNT_UNKNOWN).
- BELLE_GEMINI_API_KEY
- BELLE_GEMINI_MODEL

## Script Properties (optional)
- BELLE_QUEUE_SHEET_NAME (preferred queue sheet for receipt)
- BELLE_SHEET_NAME (legacy fallback for receipt queue sheet)
  - resolve order: BELLE_QUEUE_SHEET_NAME -> BELLE_SHEET_NAME -> OCR_RECEIPT
  - using BELLE_SHEET_NAME logs CONFIG_WARN (BELLE_SHEET_NAME_DEPRECATED)
- BELLE_ACTIVE_DOC_TYPES (comma-separated; default: receipt)
  - Allowed values: receipt, cc_statement, bank_statement
  - Include cc_statement to enable OCR_CC queue + OCR processing.
- BELLE_CC_STAGE1_GENCFG_JSON (optional; JSON string for generationConfig overrides)
- BELLE_CC_STAGE2_GENCFG_JSON (optional; JSON string for generationConfig overrides)
- BELLE_CC_ENABLE_RESPONSE_JSON_SCHEMA (default: false)
- BELLE_CC_ENABLE_RESPONSE_MIME_TYPE (default: false)
  - Enable only if the model accepts responseMimeType/responseJsonSchema; invalid argument may return 400.
- BELLE_OUTPUT_FOLDER_ID (resolve order: BELLE_OUTPUT_FOLDER_ID -> BELLE_DRIVE_FOLDER_ID)
  - CSV outputs are written under doc_type subfolders: receipt/, cc_statement/, bank_statement/.
  - Subfolders are created when missing.
  - Duplicate subfolder names are treated as errors and export is skipped per doc_type.
- BELLE_SKIP_LOG_SHEET_NAME (default: EXPORT_SKIP_LOG)
- BELLE_QUEUE_SKIP_LOG_SHEET_NAME (default: QUEUE_SKIP_LOG)
- BELLE_EXPORT_GUARD_LOG_SHEET_NAME (default: EXPORT_GUARD_LOG)
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
- BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT (default: ëŒè€äO)
  - The value must be a plain label (no extra description).
- BELLE_FALLBACK_APPEND_INVOICE_SUFFIX (default: true)
  - If false, do not append "ìKäi" to tax kubun.
- BELLE_FISCAL_START_DATE (format: YYYY-MM-DD)
- BELLE_FISCAL_END_DATE (format: YYYY-MM-DD)
  - Required for export; years must match and range must be valid.
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

### Parallel OCR (v0)
- BELLE_OCR_PARALLEL_ENABLED (boolean, default: false): enables parallel tick execution.
- BELLE_OCR_PARALLEL_WORKERS (number string, default: "1"): number of triggers to create (1-20).
- BELLE_OCR_PARALLEL_TRIGGER_TAG (string, default: "BELLE_OCR_PARALLEL_V0"): log tag for trigger management.
- BELLE_OCR_PARALLEL_TRIGGER_IDS (internal): auto-managed trigger IDs; do not edit.
- BELLE_OCR_PARALLEL_STAGGER_WINDOW_MS (number string, default: 50000): stagger window in ms (clamped to 0-59000).
- BELLE_OCR_LOCK_TTL_SECONDS (number string, default: 300): lock TTL for claim.
- BELLE_OCR_WORKER_MAX_ITEMS (number string, default: 1): max items per worker loop.
- BELLE_OCR_CLAIM_SCAN_MAX_ROWS (number string; unset = scan all rows).
- BELLE_OCR_CLAIM_CURSOR__<doc_type> (internal): auto-managed scan cursor; do not edit.
- BELLE_OCR_CLAIM_CURSOR (legacy internal, receipt only).
- BELLE_INTEGRATIONS_SHEET_ID (optional): required to write PERF_LOG (also used by webhook logs).
Notes:
- PERF_LOG v2 columns: logged_at_iso, phase, ok, doc_type, queue_sheet_name, last_reason, lock_busy_skipped, http_status, cc_error_code, cc_stage, cc_cache_hit, processing_count, detail_json.
- QUEUE_SKIP_LOG columns: logged_at_iso, phase, file_id, file_name, drive_url, doc_type, source_subfolder, reason, detail, first_seen_at_iso, last_seen_at_iso, seen_count.
- EXPORT_GUARD_LOG columns: logged_at_iso, phase, doc_type, queue_sheet_name, reason, counts_json, detail.
- When parallel enabled, runner OCR is guarded with RUN_GUARD: OCR_PARALLEL_ENABLED.
- Disable removes triggers only; BELLE_OCR_PARALLEL_ENABLED is unchanged.

## Notes
- cc_statement uses ocr_json as stage1 cache or stage2 final JSON.
- Review sheets (REVIEW_STATE/REVIEW_UI/REVIEW_LOG) are not used in fallback-v0.
- Queue sheets are split by doc_type: OCR_RECEIPT (receipt), OCR_CC (cc_statement), OCR_BANK (bank_statement).
- Queue sheet columns are extended (append-only): ocr_attempts, ocr_last_attempt_at_iso, ocr_next_retry_at_iso, ocr_error_code, ocr_error_detail.
- Export log sheet name is fixed: EXPORT_LOG (legacy IMPORT_LOG must be renamed manually).

## References
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/SYSTEM_OVERVIEW_FALLBACK_V0.md
- docs/PLAN_FALLBACK_EXPORT_v0.md



