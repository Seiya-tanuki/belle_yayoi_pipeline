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
6. OCR success writes JSON to ocr_json; errors go to ocr_error/ocr_error_detail and ocr_json is cleared.
7. Export guards:
   - OCR_PENDING (QUEUED remains)
   - OCR_RETRYABLE_REMAINING (ERROR_RETRYABLE remains)
8. Summary format: "merchant / registration_number" (item is not used). If regno is missing, use merchant only. Regno is never truncated. Optional trim: 120 Shift-JIS bytes, preserve regno.
9. V-column memo order: FIX (optional) -> BELLE|FBK=1|RID -> DM (ERROR_FINAL only) -> DT (optional) -> FN (optional) -> ERR (optional) -> FID (always last). FN is sanitized (replace "|", remove newlines, trim).
10. Tax rate inference priority:
   - tax_rate_printed
   - receipt_total_jpy + tax_total_jpy (tolerance 1 yen)
   - line_items description tax (蜀・ｶ郁ｲｻ遞守ｭ・縺・■豸郁ｲｻ遞・etc)
   - unknown -> RID=TAX_UNKNOWN or RID=MULTI_RATE
11. 8% tax kubun uses "隱ｲ蟇ｾ莉募・霎ｼ霆ｽ貂・%" for 2019-10-01 and later (Yayoi Kaikei Next import format).
12. overall_issues with only MISSING_TAX_INFO is treated as benign when tax rate is already confirmed (no FIX).
13. Date fallback (fiscal year 01/01-12/31):
   - No/invalid date -> use BELLE_FISCAL_END_DATE, RID=DATE_FALLBACK, DT=NO_DATE, FIX=隱､縺｣縺溷叙蠑墓律
   - Out of range -> replace year with fiscal year; DT=OUT_OF_RANGE, RID=DATE_FALLBACK, FIX=隱､縺｣縺溷叙蠑墓律
   - Leap invalid after replace -> use fiscal end; DT=LEAP_ADJUST
   - Do not use file_name or queued_at_iso for date fallback.
14. Destructive reset (admin only): use BELLE_RESET_TOKEN and belle_resetSpreadsheetToInitialState_fallback_v0_test (see docs/RESET_GUIDE_fallback_v0.md).
15. OCR claim (phase1): added PROCESSING and lock columns (ocr_lock_owner, ocr_lock_until_iso, ocr_processing_started_at_iso). Claim function only (no OCR); TTL expiry makes row claimable again.
16. OCR worker (phase2): belle_ocr_workerLoop_fallback_v0_test runs claim -> OCR -> writeback (locks only during claim/update), worker max items via BELLE_OCR_WORKER_MAX_ITEMS, TTL via BELLE_OCR_LOCK_TTL_SECONDS. Existing runner/processQueueOnce are unchanged.
17. OCR parallel triggers (phase4): use belle_ocr_parallel_enable_fallback_v0 / belle_ocr_parallel_disable_fallback_v0 to create/delete N time-based triggers for belle_ocr_workerTick_fallback_v0. BELLE_OCR_PARALLEL_ENABLED gates tick execution and runner OCR is skipped with RUN_GUARD. Disable removes triggers only; enabled flag is unchanged.
18. OCR parallel tuning (phase6): claim scans at most BELLE_OCR_CLAIM_SCAN_MAX_ROWS with round-robin cursor (BELLE_OCR_CLAIM_CURSOR). PERF_LOG is written to the integrations sheet when BELLE_INTEGRATIONS_SHEET_ID is set. Recommended start: workers=2, tick=1 minute; if LOCK_BUSY or 503 increases, reduce workers or extend interval.

## 3. Runner (A plan)
- belle_runPipelineBatch_v0 runs queue -> OCR only.
- No review sheet generation.
- No export in runner.

## 4. Manual export
- Run belle_exportYayoiCsvFromReview_test or belle_exportYayoiCsvFallback from the editor.
- If QUEUED remains, it logs OCR_PENDING and does not create CSV or update EXPORT_LOG.
- If ERROR_RETRYABLE remains, it logs OCR_RETRYABLE_REMAINING and does not export.
- Export log uses EXPORT_LOG. If legacy IMPORT_LOG exists, rename it to EXPORT_LOG before export.

## 5. Verification checklist (manual)
1) Run belle_runPipelineBatch_v0_test and check RUN_SUMMARY
2) With QUEUED remaining, run export and expect OCR_PENDING
3) After DONE/ERROR_FINAL only, export should create CSV and update EXPORT_LOG
4) Case A (legacy): IMPORT_LOG exists and EXPORT_LOG missing -> export is guarded; rename IMPORT_LOG to EXPORT_LOG, then retry
5) Case B (fresh): neither exists -> export creates EXPORT_LOG with header
6) Chatwork (optional): set BELLE_CHATWORK_NOTIFY_ENABLED=true and run belle_chatwork_sendLatestCsv_test (latest CSV sends file post only to avoid duplicate messages)
7) Chatwork Webhook (optional): deploy Web App with ?route=chatwork&token=<SECRET>, set BELLE_CHATWORK_WEBHOOK_ENABLED=true and BELLE_CHATWORK_WEBHOOK_TOKEN (same value as URL token). Logs are persisted to the integrations sheet (WEBHOOK_LOG) when BELLE_INTEGRATIONS_SHEET_ID is set, including BODY_CAPTURE (hash/length/preview). Token mismatch/parse errors are logged and still return 200.

## 6. References
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/SYSTEM_OVERVIEW_FALLBACK_V0.md
- docs/PLAN_FALLBACK_EXPORT_v0.md
- docs/DIFF_CHECKLIST_fallback_v0.md
