実装役を起動

Spec path:
- `.spec/specs/T-20260206-UI-U1-dashboard-script-decomposition.md`

Wave:
- Wave 4 / Track U1

Execution goal:
- Implement the spec exactly as written (`playbook: refactor-boundary`).
- Refactor `gas/Dashboard.html` client script into explicit boundaries with contract parity.

Mandatory precondition:
1. Run this track in a dedicated U1 branch/worktree only.
2. Do not run U1 implementation in a shared dirty branch.
3. Run V1 boundary proof before starting code edits, and again before finalizing.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive production-file ownership (U1):
- `gas/Dashboard.html`

2. Exclusive test-file ownership (U1):
- `tests/u1_*`

3. Forbidden file edits for U1:
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

Implementation method:
1. Follow spec AC/V steps exactly.
2. Keep production edits local to `gas/Dashboard.html` only.
3. Preserve `google.script.run` call-name contracts and UI flow parity.
4. Capture required evidence and create implementation report in `.spec/reports/`.

Required verification (from spec):
- V1 ownership/forbidden boundary proof.
- V2 dashboard decomposition helper-anchor proof.
- V3 static `google.script.run` call-name contract proof.
- V4 deterministic U1 UI-flow tests:
  - `tests/u1_dashboard_transport_contracts.js`
  - `tests/u1_dashboard_ui_flow_parity.js`
  - `tests/u1_dashboard_init_race_guard.js`
- V5 observability continuity/waiver proof:
  - `tests/u1_dashboard_observability_continuity.js`
  - include waiver text in report exactly as required by spec.
- V6 repo regression checks (`csv/typecheck/npm test`).

Supplemental risks (non-blocking, must be monitored during implementation):
1. Client/server contract drift between `Dashboard.html` and `DashboardApi.js`.
2. Mode-gate regressions in maintenance/OCR operation flows.
3. Initialization/load-order race from helper decomposition.

Final boundary check (must pass):
- `git diff --name-only -- gas tests .spec/reports`
- Allowed only:
  - `gas/Dashboard.html`
  - `tests/u1_*`
  - U1 report file under `.spec/reports/`

Do not push.
Do not run `clasp deploy`.
