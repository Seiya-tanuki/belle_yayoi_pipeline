# T-20260206-CORE-C2: Queue claim/stale/legacy responsibility split with boundary safety

## Meta
- id: T-20260206-CORE-C2
- owner_lane: consult -> implement
- risk: medium
- playbook: refactor-boundary
- scope:
  - allow_edit:
    - gas/Queue.js
    - tests/test_queue_*
    - tests/test_ocr_reap_stale.js
    - tests/test_ocr_claim_headers.js
    - tests/test_ocr_claim_cursor.js
    - tests/c2_*
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
    - gas/Export.js
    - gas/OcrWorkerParallel.js
    - gas/Dashboard*
    - gas/DocTypeRegistry.js
    - gas/Config.js
    - gas/Code.js
    - gas/ExportEntrypoints.js
    - gas/Log.js
    - tests/test_reset_headers.js
    - tests/test_doc_type_registry_callsite_smoke.js
    - tests/test_export_*
- web_search: disabled
- decision_refs:
  - none

## Goal
Refactor `gas/Queue.js` to split responsibilities into clear internal paths for ingestion, claim/lock, stale recovery, legacy normalization, and run-once execution, while preserving existing queue contracts (headers, lock/state transitions, reason/status outcomes, and queue observability fields/log phases).

## Non-goals
- No runtime feature expansion.
- No queue header contract change (column names/order/meaning for existing queue header APIs).
- No behavior-contract change for claim, stale recovery, or run-once outcomes.
- No cross-module extraction in this track (all production changes remain inside `gas/Queue.js`).
- No edits outside C2 ownership scope:
  - production: only `gas/Queue.js`
  - tests: only `tests/test_queue_*`, optionally `tests/test_ocr_reap_stale.js`, `tests/test_ocr_claim_headers.js`, `tests/test_ocr_claim_cursor.js`, and new `tests/c2_*`
- No deploy actions (`clasp deploy` prohibited; no `clasp push` in this task).

## Context / Constraints
- Primary runtime is Google Apps Script; tests are Node VM-based under `tests/`.
- Conflict-prevention ownership for C2:
  - Exclusive production ownership: `gas/Queue.js`
  - Exclusive test ownership: `tests/test_queue_*`, optional targeted OCR queue tests (`tests/test_ocr_reap_stale.js`, `tests/test_ocr_claim_headers.js`, `tests/test_ocr_claim_cursor.js`), and new `tests/c2_*` only.
- Implementation must run on a dedicated C2 branch/worktree so boundary proofs evaluate track-local diffs only.
- Runtime behavior changes: no intended expansion; this is a boundary-focused refactor with parity requirements.
- `ocr_error_code`, `ocr_error_detail`, and queue item log phases are treated as observability contracts and must remain continuous.
- `gas/*.js` comment convention remains ASCII-only.

## Proposed approach
1. Introduce private helper boundaries inside `gas/Queue.js` so each responsibility is isolated:
   - ingestion path
   - claim/lock path
   - stale recovery path
   - legacy normalization path
   - run-once execution path
2. Keep existing externally called function names and return-shape contracts unchanged.
3. Add deterministic branch/state-transition tests in C2-owned scope (including at least one new `tests/c2_*` file) to cover claim and stale recovery branches plus legacy normalization parity.
4. Run boundary proofs first, then targeted parity checks, then repository regression checks.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] `gas/Queue.js` is refactored so ingestion, claim/lock, stale recovery, legacy normalization, and run-once execution are each handled by explicit internal helper boundaries; existing externally referenced entrypoints remain callable with unchanged function names.
2. [AC-2] Claim/lock and stale recovery semantics are preserved:
   - claim keeps existing reason/status behavior (`LOCK_BUSY`, `NO_ROWS`, `NO_TARGET`) and lock write semantics (`PROCESSING`, lock owner/until/started fields).
   - stale recovery keeps existing transition semantics for expired processing locks (`PROCESSING` -> `ERROR_RETRYABLE`, `WORKER_STALE_LOCK`, lock fields cleared).
3. [AC-3] Legacy normalization and run-once behavior remain contract-parity:
   - legacy row normalization still sets `LEGACY_ERROR_IN_OCR_JSON`, keeps detail/summary behavior, clears legacy `ocr_json`, and preserves retry metadata behavior.
   - run-once execution preserves existing status/result contracts and tested outcomes.
4. [AC-4] Observability continuity is proven for queue error fields and log semantics:
   - `ocr_error_code` and `ocr_error_detail` write semantics remain intact.
   - queue log phases used by claim/stale/legacy/run-once flows remain intact (`OCR_CLAIM`, `OCR_REAP_STALE`, `OCR_LEGACY_NORMALIZE`, `OCR_ITEM_START`, `OCR_ITEM_DONE`, `OCR_ITEM_ERROR`).
5. [AC-5] Implementation remains inside C2 ownership boundaries; forbidden files stay unchanged.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V4, V5 | State-transition/parity tests pass after refactor; entrypoint and queue module boundary checks remain green. |
| AC-2 | V4 | Deterministic stale/claim tests pass, including branch and state-transition assertions. |
| AC-3 | V4, V5 | Legacy normalization and run-once parity assertions pass; queue parity smoke remains green. |
| AC-4 | V6 | Static signal proof and dynamic tests confirm continuity of `ocr_error_code`/`ocr_error_detail` and queue log phases. |
| AC-5 | V1, V2, V3 | Boundary proof commands show edits confined to allowed C2 files and no forbidden-file diffs. |

## Verification
1. [V1] Production boundary proof (must pass):
   - `git diff --name-only -- gas | rg -n '^(gas/Queue\.js)$' -v`
   - Pass criteria: no output (no `gas/` edits outside `gas/Queue.js`).
2. [V2] Test boundary proof (must pass):
   - `git diff --name-only -- tests | rg -n '^(tests/test_queue_.*|tests/test_ocr_reap_stale\.js|tests/test_ocr_claim_headers\.js|tests/test_ocr_claim_cursor\.js|tests/c2_.*)$' -v`
   - Pass criteria: no output (no C2-disallowed test edits).
3. [V3] Forbidden-file proof (must pass):
   - `git diff --name-only | rg -n '^(gas/(Export\.js|OcrWorkerParallel\.js|Dashboard.*|DocTypeRegistry\.js|Config\.js|Code\.js|ExportEntrypoints\.js|Log\.js)|tests/test_reset_headers\.js|tests/test_doc_type_registry_callsite_smoke\.js|tests/test_export_.*)$'`
   - Pass criteria: no matches.
4. [V4] State-transition focused tests (must pass):
   - `node tests/test_ocr_reap_stale.js`
   - `node tests/test_ocr_claim_headers.js`
   - `node tests/test_ocr_claim_cursor.js`
   - `node tests/c2_queue_claim_stale_legacy_transitions.js`
   - Pass criteria: all commands exit `0`; C2 test asserts claim branch behavior, stale-recovery state transition, and legacy normalization parity signals.
5. [V5] Queue parity/regression checks (must pass):
   - `node tests/test_queue_parity_smoke.js`
   - `node tests/test_queue_header_map_parity.js`
   - `node tests/test_queue_module_boundaries.js`
   - `node tests/test_queue_module_load_order_safety.js`
   - `node tests/test_queue_pdf_guard.js`
   - `node tests/test_queue_skip_log_routing.js`
   - `node tests/test_queue_skip_log_dedupe.js`
   - Pass criteria: all commands exit `0`.
6. [V6] Observability continuity proof (must pass):
   - `rg -n 'ocr_error_code|ocr_error_detail|OCR_CLAIM|OCR_REAP_STALE|OCR_LEGACY_NORMALIZE|OCR_ITEM_START|OCR_ITEM_DONE|OCR_ITEM_ERROR' gas/Queue.js`
   - `node tests/c2_queue_claim_stale_legacy_transitions.js`
   - Pass criteria: static grep finds expected observability symbols; dynamic assertions prove continuity of error-field writes and phase-level queue logs.
7. [V7] Repository regression checks (must pass):
   - `node tests/test_csv_row_regression.js`
   - `npm run typecheck`
   - `npm test`
   - Pass criteria: all commands exit `0`.

## Observability Plan (required for runtime behavior changes)
- Signals to capture:
  - Queue error fields: `ocr_error_code`, `ocr_error_detail`.
  - Queue processing phases: `OCR_CLAIM`, `OCR_REAP_STALE`, `OCR_LEGACY_NORMALIZE`, `OCR_ITEM_START`, `OCR_ITEM_DONE`, `OCR_ITEM_ERROR`.
- Where signals are emitted:
  - `gas/Queue.js` claim/stale paths, legacy normalization path, and run-once item processing path.
- Correlation keys or dimensions:
  - `file_id`, `doc_type`, `row` (when present), `reason`/`error_code`, and status transitions.
- Verification mapping:
  - V4 validates branch-level transition outcomes and field writes.
  - V6 validates static symbol continuity and dynamic log/error-field continuity.
  - V5/V7 provide parity guardrails against unintended side effects.
- Waiver:
  - none

## Safety / Rollback
- Potential failure modes:
  - lock/state transition drift during helper extraction.
  - stale recovery no longer clearing lock fields correctly.
  - legacy normalization changing retry/error-detail behavior.
  - accidental edits outside C2 ownership boundaries.
- No-go conditions (stop and revise before handoff completion):
  - any V1/V2/V3 boundary proof failure.
  - any change in queue header contract or claim/stale reason/status semantics.
  - any V4/V5/V6/V7 verification failure.
- Rollback steps:
  1. Revert only C2-touched files in scope (`gas/Queue.js` and C2-owned test files changed by this task).
  2. Re-run V4 and V5 to confirm baseline parity is restored.
  3. Re-apply refactor in smaller slices (claim/stale first, then legacy/run-once) with the same boundary proofs.

## Implementation notes (optional)
- Keep helper extraction local to `gas/Queue.js`; do not move Queue behavior into other GAS modules in this track.
- Prefer pure helper boundaries where feasible (input row/headerMap -> transition decision) to make branch semantics testable without broad mocking.
- New C2 tests must use `tests/c2_*` prefix.
