
# Rules: naming, file boundaries, and structure

## File boundaries
1) Code.js: entrypoints/wrappers only (no helper logic).
2) OcrWorkerParallel_v0.js: worker loop + OCR orchestration only; no pipeline control flow or doc_type literals.
3) Review_v0.js: export entrypoints/wrappers only.
4) Export_v0.js: export orchestration + guard logic + log routing for export phase.
5) YayoiExport_v0.js: deterministic mapping from OCR JSON -> Yayoi CSV rows.
5) OcrValidation_v0.js: schema validation only; no business decisions.
6) Config_v0.js: Script Properties parsing and canonical config access helpers.
7) Log_v0.js: log sheet plumbing (headers, rotation, append, dedupe helpers).
8) Sheet_v0.js: spreadsheet I/O primitives and header-map utilities.
9) Drive_v0.js: Drive enumeration and folder traversal helpers.
10) Pdf_v0.js: local PDF inspection utilities (page count heuristics).
11) Gemini_v0.js: Gemini HTTP client plumbing and response parsing.
13) DocTypeRegistry_v0.js: canonical doc_type registry and per-doc_type specs (subfolder/sheet/export routing).
14) Queue_v0.js: queue/import helpers; Code.js keeps thin wrappers for entrypoints only.
15) OcrCommon_v0.js: shared OCR helpers (backoff, perf row shaping, HTTP status parsing).
16) OcrCcPipeline_v0.js: cc_statement pipeline control flow (stage/cache logic).
17) OcrReceiptPipeline_v0.js: receipt pipeline control flow (single-stage OCR).

## Doc_type rules
1) Define doc_types only in DocTypeRegistry_v0.js; do not add new doc_type literals in call sites for folder/sheet/output resolution.
2) Call sites must read doc_type wiring via registry specs or wrappers (no ad-hoc lists).
3) Branching on pipeline_kind and export_handler_key must be driven by DocTypeRegistry_v0.js (no direct doc_type string comparisons).
4) Update the doc_type spec completeness test when adding a new doc_type (see tests/test_doc_type_registry_spec_completeness.js).

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
