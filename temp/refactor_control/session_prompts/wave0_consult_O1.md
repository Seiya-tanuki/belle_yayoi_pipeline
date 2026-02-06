相談役を起動

この内容で仕様書作成

Wave 0 / Track O1
Create a handoff-ready implementation spec for operational test coverage.

Target spec file:
- `.spec/specs/T-20260206-OPS-O1-maintenance-exportrun-tests.md`

Scope intent for Implement lane:
- allow_edit:
  - `gas/MaintenanceMode.js`
  - `gas/ExportRunService.js`
  - `tests/`
- forbid_edit:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`

Required meta:
- playbook: `tdd-standard`
- risk: `medium`

Required non-goals:
1. No edits to `gas/Queue.js`, `gas/Export.js`, `gas/OcrWorkerParallel.js`, `gas/Dashboard*` files.
2. No edits to shared freeze files:
   - `gas/DocTypeRegistry.js`
   - `gas/Config.js`
   - `gas/Code.js`
   - `gas/ExportEntrypoints.js`
   - `gas/Log.js`
   - `tests/test_reset_headers.js`
   - `tests/test_doc_type_registry_callsite_smoke.js`

Acceptance focus:
1. Deterministic tests for success/failure behavior of `MaintenanceMode` and `ExportRunService` paths.
2. Assertions for key returned contract fields (`reason`, `message`, `data`) where applicable.
3. No unplanned runtime behavior expansion outside this scope.

Three-drive completeness requirements:
1. AC IDs + traceability matrix + deterministic verification steps.
2. Red/Green evidence plan with concrete commands.
3. Observability plan, or explicit waiver reason if runtime behavior is unchanged.

After drafting, run spec-check and revise until handoff-ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
