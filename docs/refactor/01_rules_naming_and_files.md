
# Rules: naming, file boundaries, and structure

## File boundaries
1) Code.js: shared helpers only (pure functions where possible).
2) OcrWorkerParallel_v0.js: worker loop + OCR orchestration (doc_type branching acceptable but must remain readable).
3) Review_v0.js: export orchestration + guard logic + log routing for export phase.
4) YayoiExport_v0.js: deterministic mapping from OCR JSON -> Yayoi CSV rows.
5) OcrValidation_v0.js: schema validation only; no business decisions.
6) Config_v0.js: Script Properties parsing and canonical config access helpers.

## Naming conventions
1) Prefix by domain:
   - belle_queue_* for queue/import
   - belle_ocr_* for OCR pipeline helpers
   - belle_export_* for export orchestration
   - belle_yayoi_* for Yayoi mapping and CSV serialization
   - belle_log_* for log sheet plumbing (header, rotation, append)
2) Suffixes:
   - *_Fallback or *_v0 are legacy signals; avoid adding new ones unless strictly necessary.
   - *_Internal_ for helpers not intended as public entry points.
3) Constants:
   - UPPER_SNAKE_CASE for constants, include units when relevant: MAX_CELL_CHARS, BACKOFF_SECONDS

## Logging conventions (structure)
1) All log rows must include:
   - logged_at_iso
   - phase
   - doc_type (when applicable)
   - reason code (when applicable)
2) detail_json:
   - one JSON object, single line, no trailing prose
   - stable keys; do not store raw PII
3) Avoid log spam:
   - use dedupe keys where appropriate
   - chunked writes for large batches

## Tests
1) Every refactor that touches log plumbing must have:
   - a routing test
   - a schema/header test (rotation behavior)
2) Prefer deterministic fixtures; avoid time-dependent assertions.
