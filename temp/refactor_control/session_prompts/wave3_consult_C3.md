相談役を起動

この内容で仕様書作成

Wave 3 / Track C3
Create a handoff-ready spec for OCR worker state-transition decomposition with boundary safety.

Target spec file:
- `.spec/specs/T-20260206-CORE-C3-ocr-worker-state-split.md`

Scope intent for Implement lane:
- allow_edit:
  - `gas/OcrWorkerParallel.js`
  - `tests/`
- forbid_edit:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`

Required meta:
- playbook: `refactor-boundary`
- risk: `high`

Mandatory conflict-prevention constraints:
1. Exclusive production ownership for C3:
- `gas/OcrWorkerParallel.js`

2. Exclusive test ownership for C3:
- Existing OCR worker-focused tests only:
  - `tests/test_ocr_worker_orchestrator_boundaries.js`
  - `tests/test_ocr_worker_dispatch_parity.js`
  - `tests/test_ocr_worker_no_target.js`
  - `tests/test_ocr_parallel_stagger.js`
  - `tests/test_ocr_parallel_disable.js`
  - `tests/test_worker_pipeline_kind_parity.js`
- New C3 tests only with prefix:
  - `tests/c3_*`

3. Forbidden edits for C3:
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

Spec requirements:
1. Extraction-first refactor, no intended runtime behavior expansion.
2. Decompose `belle_ocr_workerOnce_` into explicit internal boundaries for:
- claim validation and attempt initialization
- pipeline dispatch/runner adapter
- error classification and retry/backoff decision
- writeback commit path
- telemetry/perf projection
3. Preserve behavior contracts:
- existing reason/status outcomes
- error-field write semantics (`ocr_error_code`, `ocr_error_detail`)
- retry metadata semantics (`retry_count`, `next_retry_at`)
- perf-log row layout expectations
4. Deterministic verification set must include:
- ownership/forbidden boundary proofs
- worker-focused parity checks
- at least one new deterministic C3 transition test for claim-lost and writeback/error branches
- repo baseline regression commands
5. Explicit observability continuity proof (no waiver expected):
- log phases: `OCR_ITEM_START`, `OCR_ITEM_DONE`, `OCR_ITEM_ERROR`
- error/retry fields continuity and branch-level assertions
6. Include rollback plan and concrete no-go conditions.

Supplemental risks (non-blocking, include in spec notes):
1. Queue-worker contract drift through implicit assumptions (`PROCESSING` lock handling).
2. Perf log schema/layout drift due helper extraction.
3. Load-order boundary regression between Queue/OCR worker modules.

After drafting, run spec-check and revise until implement-handoff ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
