# **WARNING: Legacy (review-sheet-v0). Do not use for fallback-v0. Use docs/SYSTEM_OVERVIEW_FALLBACK_V0.md instead.**

# SYSTEM_OVERVIEW_REVIEW_SHEET_V0

## Goal / Non-Goal
- Goal: Drive -> OCR -> Review -> CSV export (manual).
- Non-Goal: automatic integration into Yayoi; no prod/stg deployment from this repo.

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
- REVIEW_YAYOI is not referenced by code.

## Entry Points
- Manual export: belle_exportYayoiCsvFromReview

## References
- docs/CONFIG.md
- docs/WORKFLOW.md
- docs/legacy/PROJECT_STATE_SNAPSHOT_review_sheet_v0.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md