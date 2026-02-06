相談役を起動

この内容で仕様書作成

Wave 0 / Track O3
Create a handoff-ready implementation spec for server-side Dashboard API test coverage.

Target spec file:
- `.spec/specs/T-20260206-OPS-O3-dashboard-api-tests.md`

Scope intent for Implement lane:
- allow_edit:
  - `gas/DashboardApi.js`
  - `tests/`
- forbid_edit:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`

Required meta:
- playbook: `tdd-standard`
- risk: `medium`

Required non-goals:
1. No UI decomposition in this track (`gas/Dashboard.html` is out of scope).
2. No edits to `gas/DashboardWebApp.js`, `gas/DashboardMaintenanceApi.js`, `gas/Queue.js`, `gas/Export.js`, `gas/OcrWorkerParallel.js`.
3. No edits to shared freeze files:
   - `gas/DocTypeRegistry.js`
   - `gas/Config.js`
   - `gas/Code.js`
   - `gas/ExportEntrypoints.js`
   - `gas/Log.js`
   - `tests/test_reset_headers.js`
   - `tests/test_doc_type_registry_callsite_smoke.js`

Acceptance focus:
1. Deterministic server-side tests for `DashboardApi` success/failure branches and operation gating.
2. Assertions on response shape contracts and critical reason/error fields.
3. No changes to client-facing UI behavior in this wave.

Three-drive completeness requirements:
1. AC IDs + traceability matrix + deterministic verification steps.
2. Red/Green evidence plan with concrete commands.
3. Observability plan, or explicit waiver reason if runtime behavior is unchanged.

After drafting, run spec-check and revise until handoff-ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
