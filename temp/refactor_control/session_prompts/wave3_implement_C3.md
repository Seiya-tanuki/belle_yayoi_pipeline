実装役を起動

Spec path:
- `.spec/specs/T-20260206-CORE-C3-ocr-worker-state-split.md`

Wave:
- Wave 3 / Track C3

Execution goal:
- Implement the spec exactly as written (`playbook: refactor-boundary`).
- Refactor `gas/OcrWorkerParallel.js` into explicit internal state-transition boundaries with contract parity.

Mandatory precondition:
1. Run this track in a dedicated C3 branch/worktree only.
2. Do not run C3 implementation in a shared dirty branch.
3. Run V1 boundary proof before starting code edits, and again before finalizing.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive production-file ownership (C3):
- `gas/OcrWorkerParallel.js`

2. Exclusive test-file ownership (C3):
- `tests/test_ocr_worker_orchestrator_boundaries.js`
- `tests/test_ocr_worker_dispatch_parity.js`
- `tests/test_ocr_worker_no_target.js`
- `tests/test_ocr_parallel_stagger.js`
- `tests/test_ocr_parallel_disable.js`
- `tests/test_worker_pipeline_kind_parity.js`
- `tests/c3_*`

3. Forbidden file edits for C3:
- `gas/Export.js`
- `gas/Queue.js`
- `gas/Dashboard*`
- `gas/DocTypeRegistry.js`
- `gas/Config.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/Log.js`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`
- `tests/test_queue_*`
- `tests/test_export_*`
- `tests/test_ocr_reap_stale.js`
- `tests/test_ocr_claim_headers.js`
- `tests/test_ocr_claim_cursor.js`

4. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT` with exact file path and reason.
- Do not continue until consult update is provided.

Implementation method:
1. Follow spec AC/V steps exactly.
2. Keep extraction local to `gas/OcrWorkerParallel.js` only.
3. Preserve reason/status, error/retry field, and worker observability contracts.
4. Capture required evidence and create implementation report in `.spec/reports/`.

Required verification (from spec):
- V1 ownership/forbidden boundary proof.
- V2 worker decomposition boundary proof (`belle_ocr_worker_state_*_`).
- V3 existing worker-focused parity checks.
- V4 new deterministic C3 transition test (`tests/c3_ocr_worker_state_transitions.js`).
- V5 telemetry/perf projection proof (including `tests/test_perf_log_v2.js`).
- V6 observability continuity proof (`OCR_ITEM_START`, `OCR_ITEM_DONE`, `OCR_ITEM_ERROR`, error/retry fields).
- V7 repo regression checks (`csv/typecheck/npm test`).

Supplemental risks (non-blocking, must be monitored during implementation):
1. Queue-worker contract drift through implicit `PROCESSING` lock assumptions.
2. Perf log schema/layout drift during helper extraction.
3. Queue/OCR worker load-order safety regression.

Final boundary check (must pass):
- `git diff --name-only -- gas tests .spec/reports`
- Allowed only:
  - `gas/OcrWorkerParallel.js`
  - `tests/test_ocr_worker_orchestrator_boundaries.js`
  - `tests/test_ocr_worker_dispatch_parity.js`
  - `tests/test_ocr_worker_no_target.js`
  - `tests/test_ocr_parallel_stagger.js`
  - `tests/test_ocr_parallel_disable.js`
  - `tests/test_worker_pipeline_kind_parity.js`
  - `tests/c3_*`
  - C3 report file under `.spec/reports/`

Do not push.
Do not run `clasp deploy`.
