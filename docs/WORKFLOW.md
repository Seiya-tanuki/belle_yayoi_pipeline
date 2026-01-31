# WORKFLOW

THIS IS THE CURRENT SOURCE OF TRUTH FOR WORKFLOW AND ENTRYPOINTS.

## 1. Overview (current)
- queue: belle_queueFolderFilesToSheet
- ocr (single-run manual): belle_processQueueOnce
- ocr (parallel): belle_ocr_parallel_enable -> time triggers -> belle_ocr_workerTick
- export (manual): belle_exportYayoiCsv (all) / belle_exportYayoiCsvReceipt / belle_exportYayoiCsvCcStatement / belle_exportYayoiCsvBankStatement
- dispatch: worker resolves docType via DocTypeRegistry (ocr_run_once_fn -> belle_ocr_*_runOnce_)

## 2. Operation rules
1. dev Apps Script only. Do not push/deploy to prod/stg.
2. Sheets/Drive are append-only except for dashboard maintenance workflows (allowlisted sheets are cleared via row deletion).
3. Queue sheet names:
   1) receipt: BELLE_QUEUE_SHEET_NAME (optional override), else OCR_RECEIPT
   2) cc_statement: OCR_CC
   3) bank_statement: OCR_BANK
4. OCR status: QUEUED / DONE / ERROR_RETRYABLE / ERROR_FINAL.
5. OCR retry uses BELLE_OCR_MAX_ATTEMPTS and BELLE_OCR_RETRY_BACKOFF_SECONDS for ERROR_RETRYABLE.
6. OCR success writes JSON to ocr_json; errors go to ocr_error/ocr_error_detail and ocr_json is cleared.
7. OCR generationConfig overrides use BELLE_OCR_GENCFG_JSON__<doc_type>__<stage>.
8. Temperature defaults to 0.0 when generationConfig.temperature is omitted.
9. PDF inputs: receipt/cc_statement/bank_statement accept images and single-page PDFs; multi-page/unknown pagecount PDFs are skipped at queue time.
10. Export guards:
   - OCR_PENDING (QUEUED remains)
   - OCR_RETRYABLE_REMAINING (ERROR_RETRYABLE remains)
11. Summary format: "merchant / registration_number" (item is not used). If regno is missing, use merchant only. Regno is never truncated. Optional trim: 120 Shift-JIS bytes, preserve regno.
12. V-column memo order: FIX (optional) -> BELLE|FBK=1|RID -> DM (ERROR_FINAL only) -> DT (optional) -> FN (optional) -> ERR (optional) -> FID (always last). FN is sanitized (replace "|", remove newlines, trim).
13. Tax rate inference priority:
   - tax_rate_printed
   - receipt_total_jpy + tax_total_jpy (tolerance 1 yen)
   - line_items description tax (蜀・・ｽ・ｽ雋ｻ遞守ｭ・縺・・ｽ・ｽ豸郁ｲｻ遞・etc)
   - unknown -> RID=TAX_UNKNOWN or RID=MULTI_RATE
14. 8% tax kubun uses "隱ｲ蟇ｾ莉包ｿｽE霎ｼ霆ｽ貂・%" for 2019-10-01 and later (Yayoi Kaikei Next import format).
15. overall_issues with only MISSING_TAX_INFO is treated as benign when tax rate is already confirmed (no FIX).
16. Date fallback (fiscal year 01/01-12/31):
   - No/invalid date -> use BELLE_FISCAL_END_DATE, RID=DATE_FALLBACK, DT=NO_DATE, FIX=隱､縺｣縺溷叙蠑墓律
   - Out of range -> replace year with fiscal year; DT=OUT_OF_RANGE, RID=DATE_FALLBACK, FIX=隱､縺｣縺溷叙蠑墓律
   - Leap invalid after replace -> use fiscal end; DT=LEAP_ADJUST
   - Do not use file_name or queued_at_iso for date fallback.
17. Destructive reset (admin only): use BELLE_RESET_TOKEN and belle_resetSpreadsheetToInitialState.
18. OCR claim: sets PROCESSING and lock columns (ocr_lock_owner, ocr_lock_until_iso, ocr_processing_started_at_iso). TTL expiry makes row claimable again.
19. OCR worker: belle_ocr_workerTick runs claim -> OCR -> writeback (locks only during claim/update), worker max items via BELLE_OCR_WORKER_MAX_ITEMS, TTL via BELLE_OCR_LOCK_TTL_SECONDS.
20. OCR parallel triggers: use belle_ocr_parallel_enable / belle_ocr_parallel_disable to create/delete N time-based triggers for belle_ocr_workerTick. BELLE_OCR_PARALLEL_ENABLED gates tick execution. Disable removes triggers only; enabled flag is unchanged.
21. OCR parallel tuning: claim scans at most BELLE_OCR_CLAIM_SCAN_MAX_ROWS with round-robin cursor (BELLE_OCR_CLAIM_CURSOR__<doc_type>). PERF_LOG is written to the integrations sheet when BELLE_INTEGRATIONS_SHEET_ID is set.

## 3. Parallel OCR operation
- Precondition: configure Script Properties (see CONFIG.md). Lock columns are auto-added to queue sheets when missing.
- Enable: run belle_ocr_parallel_enable and confirm OCR_PARALLEL_ENABLE with triggerIds.
- Disable: run belle_ocr_parallel_disable and confirm OCR_PARALLEL_DISABLE (enabled flag is unchanged).
- Status: check enabled/trigger counts in the Apps Script triggers view (no manual status entrypoint).
- LOCK_BUSY means a tick could not acquire the claim lock and exits early.
- PERF_LOG appears only when BELLE_INTEGRATIONS_SHEET_ID is set.
- PROCESSING stale rows are reaped to ERROR_RETRYABLE with ocr_error_code=WORKER_STALE_LOCK.

## 4. Manual export
- Run belle_exportYayoiCsv (all) or belle_exportYayoiCsvReceipt / belle_exportYayoiCsvCcStatement / belle_exportYayoiCsvBankStatement from the editor.
- If QUEUED remains, it logs OCR_PENDING and does not create CSV or update EXPORT_LOG.
- If ERROR_RETRYABLE remains, it logs OCR_RETRYABLE_REMAINING and does not export.
- Export log uses EXPORT_LOG. If legacy IMPORT_LOG exists, rename it to EXPORT_LOG before export.

## 5. Verification checklist (manual)
1) With QUEUED remaining, run export and expect OCR_PENDING
2) After DONE/ERROR_FINAL only, export should create CSV and update EXPORT_LOG
3) Case A (legacy): IMPORT_LOG exists and EXPORT_LOG missing -> export is guarded; rename IMPORT_LOG to EXPORT_LOG, then retry
4) Case B (fresh): neither exists -> export creates EXPORT_LOG with header
5) Chatwork (optional): set BELLE_CHATWORK_NOTIFY_ENABLED=true and use the standard notification flow (manual *_test entrypoints were removed; rely on automated runs or tests)
6) Chatwork Webhook (optional): deploy Web App with ?route=chatwork&token=<SECRET>, set BELLE_CHATWORK_WEBHOOK_ENABLED=true and BELLE_CHATWORK_WEBHOOK_TOKEN (same value as URL token). Logs are persisted to the integrations sheet (WEBHOOK_LOG) when BELLE_INTEGRATIONS_SHEET_ID is set, including BODY_CAPTURE (hash/length/preview). Token mismatch/parse errors are logged and still return 200.

## 6. Dashboard maintenance workflows (summary)
- Export Run: export -> report snapshot -> clear allowlisted sheets (no image move).
- Archive Images: batch move from input subfolders to BELLE_IMAGES_ARCHIVE_FOLDER_ID (max 200 files or 240s, rerun until complete).
- Archive + Clear Logs: archive PERF_LOG + DASHBOARD_AUDIT_LOG into a spreadsheet, then clear originals.

## 7. References
- docs/CONFIG.md
- docs/04_Yayoi_CSV_Spec_25cols.md
- docs/03_Tax_Determination_Spec.md
- docs/02_Normalized_Model.md
- docs/09_Dev_Environment_Clasp.md
