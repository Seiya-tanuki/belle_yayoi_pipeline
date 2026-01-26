# IMPLEMENTATION_DRIFT

This file tracks known drifts between docs and current implementation.

## Current
- Queue sheets are doc_type-specific: OCR_RECEIPT, OCR_CC, OCR_BANK. Code no longer references OCR_RAW.
- Queue header includes doc_type and source_subfolder.
- Skip log header includes phase, doc_type, source_subfolder.
- Parallel OCR worker count supports 1-20; stagger window uses BELLE_OCR_PARALLEL_STAGGER_WINDOW_MS (default 50000, clamp 0-59000).
- INVALID_SCHEMA logging stores OCR JSON in ocr_error_detail (truncated to 45000); ocr_json remains empty on error.
- Claim cursor is per doc_type: BELLE_OCR_CLAIM_CURSOR__<doc_type> (legacy BELLE_OCR_CLAIM_CURSOR for receipt).
- CC uses 2-stage OCR (Stage1 classification -> Stage2 extraction) and does not extract description.
- CC allows PDF input; current flow assumes one page per PDF (multi-page PDF may need future handling).
- CC now caches Stage1 JSON in ocr_json and runs Stage2 in a later worker (ocr_json may hold stage1 cache or stage2 final JSON).
- CC can send responseMimeType/responseJsonSchema only when enabled via BELLE_CC_* properties.
- Bank OCR can override generationConfig via BELLE_BANK_STAGE2_GENCFG_JSON (applied last).
- Export writes CSVs under doc_type subfolders (receipt/, cc_statement/, bank_statement/). CC and bank export use Stage2 transactions (1 file -> multiple rows).
- Bank export skips rows with amount_sign=unknown or missing/non-positive amount_yen (EXPORT_SKIP_LOG reasons: BANK_AMOUNT_SIGN_UNKNOWN, BANK_AMOUNT_MISSING).
- Export resolves output subfolders strictly; duplicate subfolder names stop export for that doc_type.
- Export runs per doc_type independently; one doc_type error does not block the other.
- PERF_LOG uses a v2 header with promoted fields (doc_type, queue_sheet_name, http_status, cc_stage, etc.) and rotates the sheet if header mismatches.
- Export guard reasons are recorded in EXPORT_GUARD_LOG (doc_type-specific).
- Queue skip logs (phase=QUEUE_SKIP) write to QUEUE_SKIP_LOG; EXPORT_SKIP_LOG is export-only.
- QUEUE_SKIP_LOG tracks first_seen/last_seen/seen_count per (file_id, reason) instead of appending duplicates.
- Queue skips multi-page PDFs and unknown page-count PDFs at import time (local byte scan).
- PDF page-count scan prefers /Pages /Count when available, then falls back to /Type /Page occurrences.
