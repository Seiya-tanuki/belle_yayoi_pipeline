実装役を起動

Spec path:
- `.spec/specs/T-20260206-CORE-C2-queue-claim-stale-split.md`

Wave:
- Wave 2 / Track C2

Execution goal:
- Implement the spec exactly as written (`playbook: refactor-boundary`).
- Refactor `gas/Queue.js` internal responsibility boundaries with contract parity.

Mandatory precondition:
1. Run this track in a dedicated branch/worktree (C2 only).
2. Do not run C2 implementation in a shared dirty branch.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive production-file ownership (C2):
- `gas/Queue.js`

2. Exclusive test-file ownership (C2):
- `tests/test_queue_*`
- `tests/test_ocr_reap_stale.js`
- `tests/test_ocr_claim_headers.js`
- `tests/test_ocr_claim_cursor.js`
- `tests/c2_*`

3. Forbidden file edits for C2:
- `gas/Export.js`
- `gas/OcrWorkerParallel.js`
- `gas/Dashboard*`
- `gas/DocTypeRegistry.js`
- `gas/Config.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/Log.js`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`
- `tests/test_export_*`

4. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT` with exact file path and reason.
- Do not continue until consult update is provided.

Implementation method:
1. Follow spec AC/V steps exactly.
2. Execute V1/V2/V3 boundary proofs before finalizing.
3. Preserve queue header/status/error-field/log-phase contracts.
4. Capture required evidence and create implementation report in `.spec/reports/`.

Required verification (from spec):
- V1 production boundary proof.
- V2 test boundary proof.
- V3 forbidden-file proof.
- V4 state-transition focused checks (including `tests/c2_queue_claim_stale_legacy_transitions.js`).
- V5 queue parity/regression checks.
- V6 observability continuity proof (`ocr_error_code`, `ocr_error_detail`, queue phases).
- V7 repo regression checks (`csv/typecheck/npm test`).

Final boundary check (must pass):
- `git diff --name-only -- gas tests .spec/reports`
- Allowed only:
  - `gas/Queue.js`
  - `tests/test_queue_*`
  - `tests/test_ocr_reap_stale.js`
  - `tests/test_ocr_claim_headers.js`
  - `tests/test_ocr_claim_cursor.js`
  - `tests/c2_*`
  - C2 report file under `.spec/reports/`

Do not push.
Do not run `clasp deploy`.
