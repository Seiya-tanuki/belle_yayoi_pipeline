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
- Export writes CSVs under doc_type subfolders (receipt/, cc_statement/). CC export uses Stage2 transactions (1 file -> multiple rows).
- Export resolves output subfolders strictly; duplicate subfolder names stop export for that doc_type.
- Export runs per doc_type independently; one doc_type error does not block the other.
