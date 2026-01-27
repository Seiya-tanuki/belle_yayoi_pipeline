# OBSERVABILITY_AUDIT_v0

1. System-level logging map

1.1 EXPORT_LOG
- a) Sheet name/resolver: fixed sheet name "EXPORT_LOG" created/guarded by belle_getOrCreateExportLogSheet (gas/Review_v0.js belle_getOrCreateExportLogSheet, around lines 20-60). Legacy "IMPORT_LOG" triggers guard "EXPORT_LOG_MISSING_LEGACY_PRESENT" (same function).
- b) Schema (header): [file_id, exported_at_iso, csv_file_id] (gas/Review_v0.js belle_getOrCreateExportLogSheet, around line 53; also belle_getExportLogHeaderColumns_v0 in gas/Code.js around line 214).
- c) Append strategy: belle_export_flushExportLog_ builds rows and uses belle_sheet_appendRowsInChunks_ (chunked setValues, default 200) (gas/Review_v0.js belle_export_flushExportLog_, around lines 96-120; gas/Code.js belle_sheet_appendRowsInChunks_, around lines 1571-1584). Dedupe uses existing file_id in EXPORT_LOG to build importSet before export (gas/Review_v0.js belle_exportYayoiCsvReceiptFallback_, around lines 260-280; belle_exportYayoiCsvCcStatementFallback_, around lines 650-670).
- d) Producers: belle_exportYayoiCsvReceiptFallback_ and belle_exportYayoiCsvCcStatementFallback_ write to EXPORT_LOG after CSV creation via belle_export_flushExportLog_ (gas/Review_v0.js receipt export around lines 430-520; cc export around lines 760-840).
- e) Consumers: same export functions read EXPORT_LOG to prevent duplicate output (importSet in receipt/cc export) (gas/Review_v0.js belle_exportYayoiCsvReceiptFallback_ around lines 260-280; belle_exportYayoiCsvCcStatementFallback_ around lines 650-670).

1.2 EXPORT_SKIP_LOG
- a) Sheet name/resolver: BELLE_SKIP_LOG_SHEET_NAME property with default "EXPORT_SKIP_LOG" via belle_getSkipLogSheetName (gas/Code.js belle_getSkipLogSheetName, around lines 855-860).
- b) Schema (header): [logged_at_iso, phase, file_id, file_name, drive_url, doc_type, source_subfolder, reason, detail] via belle_getSkipLogHeader_ (gas/Code.js belle_getSkipLogHeader_, around lines 1594-1597).
- c) Append strategy: belle_appendSkipLogRows ensures header and appends via belle_sheet_appendRowsInChunks_ (chunk size 200) with no dedupe (gas/Code.js belle_appendSkipLogRows, around lines 1614-1635; belle_sheet_appendRowsInChunks_, around lines 1571-1584).
- d) Producers: receipt export and cc export accumulate skippedDetails and call belle_appendSkipLogRows with phase "EXPORT_SKIP" (gas/Review_v0.js belle_exportYayoiCsvReceiptFallback_, around lines 300-504; belle_exportYayoiCsvCcStatementFallback_, around lines 689-832).
- e) Consumers: none in code (no read path found for EXPORT_SKIP_LOG) (search: gas/Review_v0.js uses only write via belle_appendSkipLogRows).

1.3 QUEUE_SKIP_LOG
- a) Sheet name/resolver: BELLE_QUEUE_SKIP_LOG_SHEET_NAME property default "QUEUE_SKIP_LOG" via belle_getQueueSkipLogSheetName (gas/Code.js belle_getQueueSkipLogSheetName, around lines 860-863).
- b) Schema (header): same as skip log header (gas/Code.js belle_getSkipLogHeader_, around lines 1594-1597).
- c) Append strategy: belle_appendQueueSkipLogRows_ ensures header, reads existing file_id+reason to dedupe, and appends via belle_sheet_appendRowsInChunks_ (gas/Code.js belle_appendQueueSkipLogRows_ around lines 1642-1677; dedupe key built by belle_queue_skip_makeKey_ around line 1638).
- d) Producers: belle_queueFolderFilesToSheet writes skipped list from belle_listFilesInFolder into QUEUE_SKIP_LOG (gas/Code.js belle_queueFolderFilesToSheet around lines 330-360; belle_listFilesInFolder around lines 50-190). PDF pagecount guard also adds skip entries via belle_queue_checkPdfPageCount_ (gas/Code.js belle_queue_checkPdfPageCount_, around lines 1000-1040).
- e) Consumers: none in code (no read path found for QUEUE_SKIP_LOG) (search: gas/Code.js/Review_v0.js only writes).

1.4 PERF_LOG (integrations sheet)
- a) Sheet name/resolver: fixed sheet name "PERF_LOG" in integrations sheet resolved by BELLE_INTEGRATIONS_SHEET_ID (gas/OcrWorkerParallel_v0.js belle_ocr_perf_appendFromSummary_, around lines 64-105; belle_ocr_perf_ensureLogSheet_ around lines 33-60).
- b) Schema (header): [ts_iso, phase, worker_id, processed, done, retryable, final, lock_busy, avg_gemini_ms, p95_gemini_ms, avg_total_ms, detail] (gas/OcrWorkerParallel_v0.js belle_ocr_perf_ensureLogSheet_, around lines 33-60).
- c) Append strategy: appendRow with ScriptLock; detail JSON truncated to 2000 chars (gas/OcrWorkerParallel_v0.js belle_ocr_perf_appendFromSummary_, around lines 64-105; belle_ocr_perf_truncate_ around lines 21-25).
- d) Producers: belle_ocr_perf_appendFromSummary_ called by belle_ocr_workerTick_fallback_v0 after each tick (gas/OcrParallelTrigger_v0.js belle_ocr_workerTick_fallback_v0, around lines 110-120); summary payload built by belle_ocr_workerLoop_fallback_v0_ (gas/OcrWorkerParallel_v0.js around lines 560-660).
- e) Consumers: none in code (PERF_LOG is not read by runtime paths).

1.5 WEBHOOK_LOG (integrations sheet)
- a) Sheet name/resolver: fixed sheet name "WEBHOOK_LOG" in integrations sheet resolved by BELLE_INTEGRATIONS_SHEET_ID (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_appendLogRow_, around lines 92-105; belle_chatwork_webhook_ensureLogSheet_, around lines 66-90).
- b) Schema (header): [received_at_iso, phase, detail] (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_ensureLogSheet_, around lines 66-90).
- c) Append strategy: appendRow with ScriptLock; detail JSON truncated to 2000 chars (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_appendLogRow_ around lines 92-105; belle_chatwork_webhook_truncate_ around lines 27-30).
- d) Producers: belle_chatwork_webhook_log_ called by webhook handler phases (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_log_, around lines 107-120; handle_ emits multiple phases below).
- e) Consumers: none in code (WEBHOOK_LOG is not read by runtime paths).

1.6 Execution log (Apps Script Logger / console)
- a) Sink: Logger.log and console.log, not persisted in a sheet (usage across gas/Code.js, gas/OcrWorkerParallel_v0.js, gas/OcrParallelTrigger_v0.js, gas/Review_v0.js, gas/ChatworkWebhook_v0.js).
- b) Schema: arbitrary JSON objects with phase fields (see Section 2 for phase taxonomy).
- c) Append strategy: Logger.log / console.log only, no dedupe or chunking.
- d) Producers: run/queue/ocr/export/webhook functions throughout GAS (see Section 2 references).
- e) Consumers: humans via Apps Script executions log; no runtime reader.

2. Event taxonomy (phases)

2.1 Export phases (execution log)
- EXPORT_GUARD, EXPORT_START, EXPORT_DONE, EXPORT_ERROR, EXPORT_DOC_ERROR, TAX_RATE_METHOD, DATE_FALLBACK (gas/Review_v0.js; see phase literals around lines 45-851). These are emitted during receipt and cc export flows to indicate guard conditions, start, success, and taxonomy/date behaviors.
- EXPORT_SKIP (skip log phase stored in EXPORT_SKIP_LOG, not Logger.log) (gas/Review_v0.js uses belle_appendSkipLogRows with phase "EXPORT_SKIP" around lines 300-832; gas/Code.js belle_appendSkipLogRows around lines 1614-1635).

2.2 Queue phases (execution log)
- CONFIG_WARN (gas/Code.js belle_configWarnOnce around lines 845-852).
- OCR_ITEM_START, OCR_ITEM_DONE, OCR_ITEM_ERROR (gas/Code.js belle_processQueueOnce around lines 1218-1340) for non-parallel OCR.
- OCR_CLAIM (gas/Code.js claim helpers return phase in result around lines 1388-1568).
- OCR_REAP_STALE (gas/Code.js belle_ocr_reapStaleLocksByDocTypes_ around line 1474).
- OCR_LEGACY_NORMALIZE (gas/Code.js belle_ocr_normalizeLegacyRows_ around line 1176).
- RESET_GUARD, RESET_DONE (gas/Code.js reset path around lines 1859-1952).
- QUEUE_SKIP (skip log phase stored in QUEUE_SKIP_LOG, not Logger.log) (gas/Code.js belle_appendQueueSkipLogRows_ around lines 1642-1677).

2.3 OCR parallel phases (execution log + PERF_LOG)
- OCR_PARALLEL_GUARD, OCR_PARALLEL_TICK, OCR_PARALLEL_PERF_LOG_ERROR, OCR_PARALLEL_ENABLE, OCR_PARALLEL_DISABLE, OCR_PARALLEL_STATUS (gas/OcrParallelTrigger_v0.js around lines 100-244).
- OCR_WORKER_ITEM, GEMINI_TEMPERATURE_POLICY, OCR_WORKER_SUMMARY, OCR_PARALLEL_SMOKE (gas/OcrWorkerParallel_v0.js around lines 199-677). OCR_WORKER_SUMMARY is also persisted in PERF_LOG when BELLE_INTEGRATIONS_SHEET_ID is set (gas/OcrWorkerParallel_v0.js belle_ocr_perf_appendFromSummary_, around lines 64-105; call site in gas/OcrParallelTrigger_v0.js around lines 110-120).

2.4 Webhook / Chatwork phases
- CHATWORK_WEBHOOK_RECEIVED, CHATWORK_WEBHOOK_GUARD, CHATWORK_WEBHOOK_BODY_CAPTURE, CHATWORK_WEBHOOK_EVENT, CHATWORK_WEBHOOK_ERROR (gas/ChatworkWebhook_v0.js around lines 145-244).
- CHATWORK_WEBHOOK_LOG is used as a default phase when none is provided (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_log_, around lines 107-120).
- CHATWORK_SEND, CHATWORK_FILE, CHATWORK_LATEST_CSV are phases in return objects of Chatwork notify helpers (gas/ChatworkNotify_v0.js around lines 71-206).

3. Key fields inventory (by log surface)

3.1 PERF_LOG (detail JSON)
- detail JSON is the summary object built in belle_ocr_workerLoop_fallback_v0_ and serialized in belle_ocr_perf_appendFromSummary_ (gas/OcrWorkerParallel_v0.js around lines 560-660 and 64-105). Keys present in the summary object:
  - phase, ok, processed, done, stage1Cached, errors, retryable, final, workerId, claimedRowIndex, claimedFileId, claimedStatusBefore, claimedDocType, claimElapsedMs, lastReason, lockBusySkipped, geminiElapsedMs, totalItemElapsedMs, avgGeminiMs, p95GeminiMs, avgTotalItemMs, p95TotalItemMs, classify, httpStatus, docType, queueSheetName, docTypes, ccStage, ccCacheHit, ccGeminiMs, ccHttpStatus, ccErrorCode, processingCount (gas/OcrWorkerParallel_v0.js belle_ocr_workerLoop_fallback_v0_, around lines 560-660).
- doc_type propagation: summary.docType and summary.queueSheetName are set from worker item (gas/OcrWorkerParallel_v0.js around lines 631-636); cc-specific fields are set when docType == cc_statement (same block).

3.2 EXPORT_LOG
- Header columns: file_id, exported_at_iso, csv_file_id (gas/Review_v0.js belle_getOrCreateExportLogSheet around lines 53-55).
- Population: exportFileIds are appended with same timestamp and csvFileId via belle_export_flushExportLog_ (gas/Review_v0.js around lines 96-120; write call in receipt/cc export around lines 430-520 and 760-840).
- doc_type/source_subfolder: not stored in EXPORT_LOG (schema only contains three columns; gas/Review_v0.js around lines 53-55).

3.3 EXPORT_SKIP_LOG
- Header columns: logged_at_iso, phase, file_id, file_name, drive_url, doc_type, source_subfolder, reason, detail (gas/Code.js belle_getSkipLogHeader_ around lines 1594-1597).
- Population: Review_v0 builds skippedDetails with file_id/file_name/drive_url/doc_type/source_subfolder and reason (examples: DOC_TYPE_NOT_RECEIPT, OCR_NOT_DONE, OCR_JSON_MISSING, CC_INVALID_SCHEMA, CC_NO_DEBIT_ROWS) and writes via belle_appendSkipLogRows with phase "EXPORT_SKIP" (gas/Review_v0.js receipt export around lines 300-504; cc export around lines 689-832).
- doc_type/source_subfolder propagation: both fields are passed from queue sheet columns for both receipt and cc export (gas/Review_v0.js around lines 320-340 and 720-740).

3.4 QUEUE_SKIP_LOG
- Header columns: same as skip log header (gas/Code.js belle_getSkipLogHeader_ around lines 1594-1597).
- Population: belle_listFilesInFolder creates skip objects with file_id/file_name/drive_url/doc_type/source_subfolder/reason/detail and belle_queueFolderFilesToSheet writes them via belle_appendQueueSkipLogRows_ (gas/Code.js belle_listFilesInFolder around lines 50-190; belle_queueFolderFilesToSheet around lines 330-360).
- doc_type/source_subfolder propagation: set in skip objects for doc_type-related skips (UNKNOWN_SUBFOLDER uses source_subfolder only; DUPLICATE_SUBFOLDER_NAME includes doc_type and subfolder; MULTI_PAGE_PDF and PDF_PAGECOUNT_UNKNOWN include doc_type and source_subfolder) (gas/Code.js belle_listFilesInFolder around lines 60-140; belle_queue_checkPdfPageCount_ around lines 1000-1040).

3.5 WEBHOOK_LOG
- Header columns: received_at_iso, phase, detail (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_ensureLogSheet_ around lines 66-90).
- Detail JSON keys by phase:
  - CHATWORK_WEBHOOK_RECEIVED: route, parameter_keys, body_length, body_head, has_signature (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_handle_ around lines 145-160).
  - CHATWORK_WEBHOOK_GUARD: ok, reason, plus route/expected/body_preview as applicable (same function around lines 156-209).
  - CHATWORK_WEBHOOK_BODY_CAPTURE: webhook_event_type, body_source, event_keys, body_present, body_length_raw, body_length_sanitized, body_hash_sha256, body_preview, sanitize_note (gas/ChatworkWebhook_v0.js around lines 222-236).
  - CHATWORK_WEBHOOK_EVENT: webhook_setting_id, webhook_event_type, webhook_event_time, room_id, account_id, message_id, body_preview (gas/ChatworkWebhook_v0.js belle_chatwork_webhook_logEvent_ around lines 122-137).
  - CHATWORK_WEBHOOK_ERROR: ok, message (gas/ChatworkWebhook_v0.js doPost around lines 238-244).
- doc_type/source_subfolder: not applicable (webhook log is unrelated to doc types).

4. Failure-mode visibility

4.1 Queue-time skips (unknown subfolder, root-level file, duplicate subfolder, multi-page/unknown PDF)
- Where it appears: QUEUE_SKIP_LOG entries with phase QUEUE_SKIP and reason codes ROOT_LEVEL_FILE, UNKNOWN_SUBFOLDER, DUPLICATE_SUBFOLDER_NAME, DOC_TYPE_INACTIVE, MULTI_PAGE_PDF, PDF_PAGECOUNT_UNKNOWN (skips created in gas/Code.js belle_listFilesInFolder around lines 60-140 and belle_queue_checkPdfPageCount_ around lines 1000-1040; written in belle_queueFolderFilesToSheet around lines 330-360 via belle_appendQueueSkipLogRows_ around lines 1642-1677).
- What to look at first: QUEUE_SKIP_LOG for reason + detail (it is the only persisted log for queue skips; no consumer uses it) (gas/Code.js belle_appendQueueSkipLogRows_ around lines 1642-1677).
- Sufficiency: reason + detail include doc_type/source_subfolder for doc-type folders and pagecount details for PDF skips (gas/Code.js belle_queue_checkPdfPageCount_ around lines 1000-1040).

4.2 Claim/lock contention (NO_ROWS, NO_TARGET, LOCK_BUSY, stale reaper)
- Claim outcomes are returned as reason strings and propagated into the worker summary (summary.lastReason, lockBusySkipped, processingCount) (gas/OcrWorkerParallel_v0.js belle_ocr_workerLoop_fallback_v0_ around lines 588-616).
- PERF_LOG detail captures lastReason and lockBusySkipped when BELLE_INTEGRATIONS_SHEET_ID is set (gas/OcrWorkerParallel_v0.js belle_ocr_perf_appendFromSummary_ around lines 64-105; summary keys at lines 560-660).
- Execution log also records OCR_PARALLEL_GUARD reason LOCK_BUSY and OCR_WORKER_ITEM outcome CLAIM_LOST (gas/OcrParallelTrigger_v0.js around lines 104-140; gas/OcrWorkerParallel_v0.js around lines 199-205 and 515).
- Stale reaper activity logs OCR_REAP_STALE with fixed count/sampleFileIds (gas/Code.js belle_ocr_reapStaleLocksByDocTypes_ around line 1474) and writes ERROR_RETRYABLE with errorCode WORKER_STALE_LOCK into queue sheet (gas/Code.js belle_ocr_buildStaleRecovery_ around lines 790-815).
- What to look at first: PERF_LOG detail for lastReason/lockBusySkipped when available; otherwise Apps Script execution logs for OCR_PARALLEL_GUARD/OCR_WORKER_ITEM (same references as above).

4.3 CC Stage1 / Stage2 (cache hit/miss, empty rows, schema invalid, HTTP errors)
- Cache hit/miss: summary fields ccStage, ccCacheHit, ccGeminiMs, ccHttpStatus, ccErrorCode are set for cc_statement items (gas/OcrWorkerParallel_v0.js belle_ocr_workerLoop_fallback_v0_ around lines 631-641). These are only persisted in PERF_LOG detail when integrations sheet is enabled (gas/OcrWorkerParallel_v0.js belle_ocr_perf_appendFromSummary_ around lines 64-105).
- Empty rows extracted: Stage2 with missing/empty transactions triggers ERROR_RETRYABLE with errorCode CC_NO_ROWS_EXTRACTED; keep cache true (gas/Code.js belle_ocr_cc_buildStage2NoRowsWriteback_ around lines 520-533; used in gas/OcrWorkerParallel_v0.js around lines 336-352). Error code and message are written into queue sheet columns ocr_error_code/ocr_error/ocr_error_detail (gas/OcrWorkerParallel_v0.js around lines 488-510).
- Schema invalid: INVALID_SCHEMA is thrown during parsing/validation; errorCode set to INVALID_SCHEMA and error_detail contains OCR JSON (truncated) (gas/OcrWorkerParallel_v0.js around lines 340-370 and 422-436; belle_ocr_buildInvalidSchemaLogDetail_ in gas/Code.js around lines 760-768). These are not persisted in log sheets except via queue sheet columns (same writeback block around lines 488-510).
- HTTP errors (5xx/4xx): classified by belle_ocr_classifyError (gas/Code.js around lines 765-804) and mapped to errorCode RETRYABLE or NON_RETRYABLE; statusOut becomes ERROR_RETRYABLE/ERROR_FINAL and is written to queue sheet columns (gas/OcrWorkerParallel_v0.js around lines 422-438 and 488-510). The only persistent log for these is the queue sheet; PERF_LOG detail has httpStatus/classify if integrations enabled (gas/OcrWorkerParallel_v0.js summary keys around lines 621-641).
- What to look at first: Queue sheet columns (ocr_error_code, ocr_error, ocr_error_detail) for the specific file_id; PERF_LOG detail for ccStage/ccCacheHit/httpStatus if integrations sheet is enabled (references above).

4.4 Export gating per sheet, duplicate prevention, credit skips
- Export gating is per doc_type: receipt and cc export are invoked independently and errors are logged as EXPORT_DOC_ERROR without blocking the other (gas/Review_v0.js belle_exportYayoiCsvFallback around lines 120-145).
- Each export checks counts and may emit EXPORT_GUARD with reason OCR_PENDING or OCR_RETRYABLE_REMAINING if queued/retryable rows remain (receipt: gas/Review_v0.js around lines 228-256; cc: around lines 605-635). These are Logger.log only (no sheet).
- Duplicate prevention uses EXPORT_LOG file_id set (importSet) before export; duplicate files are skipped silently (gas/Review_v0.js around lines 260-280 and 650-670).
- Credit skips: CC export logs CC_CREDIT_UNSUPPORTED or CC_AMOUNT_INVALID as EXPORT_SKIP entries via built.skipDetails (gas/YayoiExport_v0.js belle_yayoi_buildCcRowsFromStage2_ around lines 462-490; write in gas/Review_v0.js around lines 748-770).
- What to look at first: EXPORT_GUARD in execution logs for gating; EXPORT_LOG to see which file_id exported; EXPORT_SKIP_LOG for credit/skipped reasons (same references above).

5. Gaps vs. ?good enough? (recommendations, no code)

5.1 Gaps
- PERF_LOG is optional and uses a single JSON detail field; key triage fields (docType, lastReason, ccStage, httpStatus) are not visible without JSON parsing (gas/OcrWorkerParallel_v0.js belle_ocr_perf_appendFromSummary_ around lines 64-105; summary keys around lines 560-660).
- Export guard reasons are only in execution logs and are not persisted to any sheet (gas/Review_v0.js EXPORT_GUARD Logger.log around lines 228-256 and 605-635).
- Queue skip detail lacks a canonical unique id for a file beyond file_id+reason (dedupe uses file_id||reason only), making it hard to differentiate repeated skip events with changed conditions (gas/Code.js belle_appendQueueSkipLogRows_ around lines 1642-1677).

5.2 Minimal change proposals
- Promote docType, lastReason, httpStatus, ccStage, ccErrorCode into PERF_LOG header columns to make ?cause visible at a glance? without JSON parsing (source keys in gas/OcrWorkerParallel_v0.js summary around lines 560-660).
- Add a lightweight EXPORT_GUARD log sheet (or append to EXPORT_SKIP_LOG with phase EXPORT_GUARD) to persist gate reasons and counts (gate data in gas/Review_v0.js around lines 228-256 and 605-635).
- Add a short ?skip_run_id? or ?skip_seen_at_iso? to QUEUE_SKIP_LOG detail to differentiate repeated skip contexts while keeping dedupe by file_id||reason (current dedupe in gas/Code.js around lines 1642-1677).

5.3 Medium change proposals
- Split PERF_LOG into header columns + detail JSON for stable fields; keep detailed JSON for optional fields (summary keys in gas/OcrWorkerParallel_v0.js around lines 560-660).
- Add a small EXPORT_METRICS_LOG sheet to persist per-run summary (exportedRows, skipped, errors) instead of relying on execution logs (receipt/cc export return objects around gas/Review_v0.js lines 460-520 and 788-840).

5.4 Risks
- Extra columns increase sheet width and write volume (PERF_LOG appendRow per tick; gas/OcrWorkerParallel_v0.js around lines 64-105).
- Additional logs risk leaking PII if raw merchant names or file names are included (current skip log already includes file_name/drive_url; gas/Code.js belle_appendSkipLogRows around lines 1614-1635).
- Persisting guard logs increases sheet growth and may require periodic cleanup.

6. Candidate header promotions shortlist (ranked)

6.1 PERF_LOG
1) docType + queueSheetName: immediate visibility of which pipeline is backing up (summary keys in gas/OcrWorkerParallel_v0.js around lines 631-636). Cost: 2 columns; low risk.
2) lastReason + lockBusySkipped: clarifies claim contention vs no target (summary keys in gas/OcrWorkerParallel_v0.js around lines 588-616). Cost: 2 columns; low risk.
3) httpStatus + ccErrorCode: highlights 4xx/5xx vs schema errors (summary keys in gas/OcrWorkerParallel_v0.js around lines 621-641). Cost: 2 columns; low risk.
4) ccStage + ccCacheHit: confirms cache behavior without parsing detail JSON (summary keys in gas/OcrWorkerParallel_v0.js around lines 631-641). Cost: 2 columns; low risk.

6.2 EXPORT_SKIP_LOG
- Promote reason to a top-level filterable column is already present; next candidate would be a separate "skip_kind" (queue vs export) if logs are ever merged. Currently not needed because queue/export are separate sheets (gas/Code.js belle_getQueueSkipLogSheetName around lines 860-863; belle_getSkipLogSheetName around lines 855-860).

7. Appendix: Source index
- gas/Code.js: belle_listFilesInFolder (queue skip reasons), belle_queueFolderFilesToSheet (queue skip write), belle_appendSkipLogRows / belle_appendQueueSkipLogRows_ (skip log schema & append), belle_ocr_classifyError (error classification).
- gas/Review_v0.js: belle_getOrCreateExportLogSheet (EXPORT_LOG schema/guard), belle_export_flushExportLog_ (append strategy), belle_exportYayoiCsvReceiptFallback_ / belle_exportYayoiCsvCcStatementFallback_ (export gating and skip logs).
- gas/OcrWorkerParallel_v0.js: belle_ocr_perf_ensureLogSheet_ / belle_ocr_perf_appendFromSummary_ (PERF_LOG), belle_ocr_workerLoop_fallback_v0_ (summary detail keys), OCR_WORKER_ITEM logging.
- gas/OcrParallelTrigger_v0.js: belle_ocr_workerTick_fallback_v0 and parallel guard/enable/disable/status phases.
- gas/ChatworkWebhook_v0.js: WEBHOOK_LOG schema and phase payloads.
- gas/YayoiExport_v0.js: CC skip reasons (CC_CREDIT_UNSUPPORTED/CC_AMOUNT_INVALID) and memo composition.
- docs/CONFIG.md, docs/IMPLEMENTATION_DRIFT.md, docs/WORKFLOW.md, docs/SYSTEM_OVERVIEW_FALLBACK_V0.md: existing log references and property notes.
