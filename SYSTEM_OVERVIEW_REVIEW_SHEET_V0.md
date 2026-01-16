# SYSTEM_OVERVIEW_REVIEW_SHEET_V0

## Goal / Non-Goal
- Goal: Automate Drive -> OCR -> structured data -> review -> CSV export for Yayoi import (manual export).
- Non-Goal: No automatic integration into Yayoi; no production/staging deployment from this repo.

## Data Flow (State Transitions)
```mermaid
flowchart LR
  A[Drive files] --> B[Queue (OCR_RAW / QUEUE sheet)]
  B --> C[OCR (DONE/ERROR)]
  C --> D[REVIEW_STATE]
  D --> E[REVIEW_UI overrides]
  E --> F[Manual Export -> CSV]
```
- Queue sheet status: QUEUED -> PROCESSING -> DONE / ERROR / SKIPPED
- review_status: empty = OK, NEEDS_REVIEW = manual fix required
- STRICT_EXPORT: true blocks export if any NEEDS_REVIEW remains

## Sheets (Who touches what)
- OCR_RAW (or QUEUE via BELLE_QUEUE_SHEET_NAME): system writes; users generally do not edit.
- REVIEW_UI: the only user-facing sheet for overrides (tax_rate_bucket_override, debit_tax_kubun_override, memo_override).
- REVIEW_STATE: internal truth; system writes and recalculates; users should not edit.
- REVIEW_LOG / IMPORT_LOG / EXPORT_SKIP_LOG: audit logs; do not edit.

## Script Properties (Required / Optional)
Required:
- BELLE_SHEET_ID: Spreadsheet ID for all sheets.
- BELLE_DRIVE_FOLDER_ID: Source Drive folder ID.
- BELLE_GEMINI_API_KEY: OCR API key.
- BELLE_GEMINI_MODEL: OCR model name.

Optional (typical values):
- BELLE_QUEUE_SHEET_NAME: queue sheet name (defaults to BELLE_SHEET_NAME).
- BELLE_SHEET_NAME: default sheet name (used by queue when above is missing).
- BELLE_OUTPUT_FOLDER_ID: CSV output folder (defaults to BELLE_DRIVE_FOLDER_ID).
- BELLE_STRICT_EXPORT: true/false (default false).
- BELLE_EXPORT_BATCH_MAX_ROWS: 5000 (default 5000).
- BELLE_CSV_ENCODING: SHIFT_JIS (default SHIFT_JIS).
- BELLE_CSV_EOL: CRLF (default CRLF).
- BELLE_REVIEW_STATE_SHEET_NAME: REVIEW_STATE (default).
- BELLE_REVIEW_UI_SHEET_NAME: REVIEW_UI (default).
- BELLE_REVIEW_LOG_SHEET_NAME: REVIEW_LOG (default).
- BELLE_IMPORT_LOG_SHEET_NAME: IMPORT_LOG (default).
- BELLE_SKIP_LOG_SHEET_NAME: EXPORT_SKIP_LOG (default).
- BELLE_RUN_MAX_SECONDS: 240 (default).
- BELLE_RUN_MAX_OCR_ITEMS_PER_BATCH: 5 (default).
- BELLE_RUN_DO_QUEUE / BELLE_RUN_DO_OCR / BELLE_RUN_DO_EXPORT: true/true/false (defaults).
- BELLE_GEMINI_SLEEP_MS: 500 (default).
- BELLE_MAX_ITEMS_PER_RUN: 1 (default).

## Entry Points
- Trigger: belle_runPipelineBatch_v0
  - Reads: Drive + Queue + OCR + Review_STATE/UI
  - Writes: Queue sheet, REVIEW_STATE, REVIEW_UI, REVIEW_LOG
  - Export is disabled by default (BELLE_RUN_DO_EXPORT=false)
- Manual export: belle_exportYayoiCsvFromReview_test
  - Reads: REVIEW_STATE + REVIEW_UI
  - Writes: CSV file to Drive, REVIEW_STATE export columns, IMPORT_LOG

## Resume Checklist (after pull)
1) Read docs/CONFIG.md and docs/WORKFLOW.md.
2) Confirm Script Properties in Apps Script project.
3) Run belle_runPipelineBatch_v0_test once (dev) and confirm REVIEW_STATE / REVIEW_UI updated.
4) Edit REVIEW_UI overrides as needed.
5) Run belle_exportYayoiCsvFromReview_test and check logs + CSV file output.

Common gotchas:
- STRICT_BLOCKED: check REVIEW_STATE for review_status=NEEDS_REVIEW and review_reason.
- Overrides not applied: confirm REVIEW_UI headers match and review_key is present.

## Troubleshooting (minimal)
- STRICT_BLOCKED:
  - See logs in Apps Script and check REVIEW_STATE review_status.
- Overrides not reflected:
  - Ensure REVIEW_UI has review_key and override columns; run belle_buildReviewFromDoneQueue again.

## References
- docs/CONFIG.md
- docs/WORKFLOW.md
- docs/PROJECT_STATE_SNAPSHOT.md
