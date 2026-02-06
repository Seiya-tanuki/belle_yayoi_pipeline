相談役を起動

この内容で仕様書作成

Wave 4 / Track U1
Create a handoff-ready spec for dashboard client script decomposition with boundary safety.

Target spec file:
- `.spec/specs/T-20260206-UI-U1-dashboard-script-decomposition.md`

Scope intent for Implement lane:
- allow_edit:
  - `gas/Dashboard.html`
  - `tests/u1_*`
- forbid_edit:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`

Required meta:
- playbook: `refactor-boundary`
- risk: `medium`

Mandatory conflict-prevention constraints:
1. Exclusive production ownership for U1:
- `gas/Dashboard.html`

2. Exclusive test ownership for U1:
- New tests only with prefix: `tests/u1_*`

3. Forbidden edits for U1:
- `gas/DashboardApi.js`
- `gas/Export.js`
- `gas/Queue.js`
- `gas/OcrWorkerParallel.js`
- `gas/DocTypeRegistry.js`
- `gas/Config.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/Log.js`
- `tests/test_dashboard_*`
- `tests/t1_*`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`

4. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT` with exact file path and reason.
- Do not continue until consult update is provided.

Spec requirements:
1. Refactor-only decomposition of dashboard client script inside `gas/Dashboard.html`.
2. Preserve existing `google.script.run` call contracts and UI behavior parity.
3. Define explicit internal boundaries (state/model projection, render helpers, action wiring, transport adapter).
4. Deterministic verification set must include:
- ownership/forbidden boundary proofs
- static contract checks for `google.script.run` call names
- deterministic UI-flow checks via U1-owned tests
- repo baseline regression commands
5. Observability handling:
- if runtime observability is unchanged, include explicit waiver reason;
- if any client log/trace behavior is touched, define continuity proof.
6. Include rollback plan and concrete no-go conditions.

Supplemental risks (non-blocking, include in spec notes):
1. Client/server contract drift between `Dashboard.html` and `DashboardApi.js`.
2. Action-button mode-gate regressions in maintenance/OCR flows.
3. Load-order or script initialization race caused by decomposition.

After drafting, run spec-check and revise until implement-handoff ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
