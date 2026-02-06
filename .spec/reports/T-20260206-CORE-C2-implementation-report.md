# Report: T-20260206-CORE-C2 Queue claim/stale/legacy responsibility split

## Summary
- Refactored `gas/Queue.js` with explicit internal boundaries for ingestion row building/appending, claim context + lock write path, stale recovery application, legacy normalization, run-once target collection, and single-target execution.
- Preserved queue behavior contracts for claim reasons/statuses, stale lock transitions, legacy normalization writes, and run-once status/log/error-field semantics.
- Added C2-owned transition test `tests/c2_queue_claim_stale_legacy_transitions.js` to verify claim/stale/legacy/run-once observability and state transitions.

## Scope Guard
- Edited production files:
  1. `gas/Queue.js`
- Edited test files:
  1. `tests/c2_queue_claim_stale_legacy_transitions.js`
- Edited report files:
  1. `.spec/reports/T-20260206-CORE-C2-implementation-report.md`
- No forbidden file edits detected.

## AC Traceability
| AC ID | Verification | Evidence |
| --- | --- | --- |
| AC-1 | V4, V5 | Claim/stale/legacy/run-once branch tests pass; queue parity and module boundary/load-order checks pass. |
| AC-2 | V4 | `test_ocr_reap_stale`, `test_ocr_claim_headers`, `test_ocr_claim_cursor`, and `c2_queue_claim_stale_legacy_transitions` all pass with expected stale transition and claim reason/status behavior. |
| AC-3 | V4, V5 | C2 transition test validates legacy normalization writes and run-once done/error outcomes; queue parity suite remains green. |
| AC-4 | V6 | Static grep confirms observability symbols in `gas/Queue.js`; C2 test validates dynamic continuity for `ocr_error_code`, `ocr_error_detail`, and queue phases. |
| AC-5 | V1, V2, V3 | Boundary proofs produced no disallowed matches. |

## Evidence
- V1 Production boundary proof
  1. `git diff --name-only -- gas 2>$null | rg -n '^(gas/Queue\.js)\r?$' -v`
     - Result: no output (pass)
- V2 Test boundary proof
  1. `git diff --name-only -- tests 2>$null | rg -n '^(tests/test_queue_.*|tests/test_ocr_reap_stale\.js|tests/test_ocr_claim_headers\.js|tests/test_ocr_claim_cursor\.js|tests/c2_.*)\r?$' -v`
     - Result: no output (pass)
- V3 Forbidden-file proof
  1. `git diff --name-only 2>$null | rg -n '^(gas/(Export\.js|OcrWorkerParallel\.js|Dashboard.*|DocTypeRegistry\.js|Config\.js|Code\.js|ExportEntrypoints\.js|Log\.js)|tests/test_reset_headers\.js|tests/test_doc_type_registry_callsite_smoke\.js|tests/test_export_.*)\r?$'`
     - Result: no output (pass)
- V4 State-transition focused checks
  1. `node tests/test_ocr_reap_stale.js` -> `OK: test_ocr_reap_stale`
  2. `node tests/test_ocr_claim_headers.js` -> `OK: test_ocr_claim_headers`
  3. `node tests/test_ocr_claim_cursor.js` -> `OK: test_ocr_claim_cursor`
  4. `node tests/c2_queue_claim_stale_legacy_transitions.js` -> `OK: c2_queue_claim_stale_legacy_transitions`
- V5 Queue parity/regression checks
  1. `node tests/test_queue_parity_smoke.js` -> `OK: test_queue_parity_smoke`
  2. `node tests/test_queue_header_map_parity.js` -> `OK: test_queue_header_map_parity`
  3. `node tests/test_queue_module_boundaries.js` -> `OK: test_queue_module_boundaries`
  4. `node tests/test_queue_module_load_order_safety.js` -> `OK: test_queue_module_load_order_safety`
  5. `node tests/test_queue_pdf_guard.js` -> `OK: test_queue_pdf_guard`
  6. `node tests/test_queue_skip_log_routing.js` -> `OK: test_queue_skip_log_routing`
  7. `node tests/test_queue_skip_log_dedupe.js` -> `OK: test_queue_skip_log_dedupe`
- V6 Observability continuity proof
  1. `rg -n 'ocr_error_code|ocr_error_detail|OCR_CLAIM|OCR_REAP_STALE|OCR_LEGACY_NORMALIZE|OCR_ITEM_START|OCR_ITEM_DONE|OCR_ITEM_ERROR' gas/Queue.js`
     - Result: all required symbols found
  2. `node tests/c2_queue_claim_stale_legacy_transitions.js` -> `OK: c2_queue_claim_stale_legacy_transitions`
- V7 Repository regression checks
  1. `node tests/test_csv_row_regression.js` -> `OK: test_csv_row_regression`
  2. `npm run typecheck` -> pass
  3. `npm test` -> pass (full suite)

## TDD Evidence
- Not applicable (`playbook: refactor-boundary`, not `tdd-standard`).

## Observability Evidence
- Error fields preserved:
  - `ocr_error_code`
  - `ocr_error_detail`
- Queue phases preserved and observed:
  - `OCR_CLAIM`
  - `OCR_REAP_STALE`
  - `OCR_LEGACY_NORMALIZE`
  - `OCR_ITEM_START`
  - `OCR_ITEM_DONE`
  - `OCR_ITEM_ERROR`
- Dynamic proof location:
  - `tests/c2_queue_claim_stale_legacy_transitions.js`

## Risks / Notes
- `npm run typecheck` initially failed because `tsc` was not installed in local dependencies; `npm install` was run in this worktree before rerunning V7.
- No deploy actions were executed (`clasp deploy` not used).
- No push/commit performed.

## Hand-off
- Ready for Consult lane/judge review against `T-20260206-CORE-C2-queue-claim-stale-split.md`.
