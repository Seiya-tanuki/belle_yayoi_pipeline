相談役を起動

この内容で仕様書作成

Wave 2 / Track C1
Create a handoff-ready spec for Export core skeleton extraction with boundary safety.

Target spec file:
- `.spec/specs/T-20260206-CORE-C1-export-skeleton-extraction.md`

Scope intent for Implement lane:
- allow_edit:
  - `gas/Export.js`
  - `tests/`
- forbid_edit:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`

Required meta:
- playbook: `refactor-boundary`
- risk: `medium`

Mandatory conflict-prevention constraints:
1. Exclusive production ownership for C1:
- `gas/Export.js`

2. Exclusive test ownership for C1:
- Existing export-focused tests only (prefix: `tests/test_export_*`)
- New C1 helper tests only with prefix: `tests/c1_*`

3. Forbidden edits for C1:
- `gas/Queue.js`
- `gas/OcrWorkerParallel.js`
- `gas/Dashboard*`
- `gas/DocTypeRegistry.js`
- `gas/Config.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/Log.js`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`
- Queue-owned tests (`tests/test_queue_*`)

Spec requirements:
1. Extraction-first, no intended runtime behavior change.
2. Boundary definition for what must remain in `gas/Export.js` and what internal helper layers will be introduced.
3. Deterministic verification including:
- boundary proof commands (forbidden signatures / ownership checks)
- parity/regression checks
4. Explicit observability handling:
- either continuity proof for existing export signals (`EXPORT_GUARD`, `EXPORT_DONE`, `EXPORT_ERROR` paths)
- or explicit waiver reason if runtime behavior is strictly unchanged.
5. Include rollback plan and no-go conditions.

Acceptance focus:
1. Reduce duplicated skeleton logic across doc-type flows while preserving output contracts.
2. Preserve existing entrypoint behavior and existing test outcomes.
3. Keep changes confined to C1 ownership scope.

After drafting, run spec-check and revise until implement-handoff ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
