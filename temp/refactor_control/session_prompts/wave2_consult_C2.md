相談役を起動

この内容で仕様書作成

Wave 2 / Track C2
Create a handoff-ready spec for Queue claim/stale/legacy responsibility split with boundary safety.

Target spec file:
- `.spec/specs/T-20260206-CORE-C2-queue-claim-stale-split.md`

Scope intent for Implement lane:
- allow_edit:
  - `gas/Queue.js`
  - `tests/`
- forbid_edit:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`

Required meta:
- playbook: `refactor-boundary`
- risk: `medium`

Mandatory conflict-prevention constraints:
1. Exclusive production ownership for C2:
- `gas/Queue.js`

2. Exclusive test ownership for C2:
- Existing queue-focused tests only (prefix: `tests/test_queue_*`)
- Existing targeted OCR queue tests only if strictly needed:
  - `tests/test_ocr_reap_stale.js`
  - `tests/test_ocr_claim_headers.js`
  - `tests/test_ocr_claim_cursor.js`
- New C2 helper tests only with prefix: `tests/c2_*`

3. Forbidden edits for C2:
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
- Export-owned tests (`tests/test_export_*`)

Spec requirements:
1. Responsibility split intent: separate ingestion, claim/lock, stale recovery, legacy normalization, and run-once execution paths inside Queue module boundaries.
2. No intended runtime behavior expansion; contract parity first.
3. Deterministic verification including:
- boundary proof commands
- state-transition focused tests for stale recovery and claim branches
- parity/regression checks
4. Explicit observability handling:
- continuity proof for queue error fields/log semantics (`ocr_error_code`, `ocr_error_detail`, queue item logs)
- or explicit waiver reason when no runtime signal change is intended.
5. Include rollback plan and no-go conditions.

Acceptance focus:
1. Reduce responsibility concentration in `gas/Queue.js` without changing queue header contract.
2. Preserve lock/state transition semantics and existing tested outcomes.
3. Keep changes confined to C2 ownership scope.

After drafting, run spec-check and revise until implement-handoff ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
