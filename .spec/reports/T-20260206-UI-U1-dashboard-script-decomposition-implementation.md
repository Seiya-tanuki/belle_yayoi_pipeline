# Report: T-20260206-UI-U1 Dashboard client script decomposition with boundary safety

## Summary
- Refactored `gas/Dashboard.html` client logic into explicit internal boundaries while preserving call-name contracts and UI behavior parity.
- Added U1-owned deterministic tests under `tests/u1_*` to verify transport callback routing, UI-flow parity, init race guard, and observability continuity.
- Kept production edits scoped to `gas/Dashboard.html` only; no forbidden files were edited.

## Traceability Evidence
- AC coverage:
  1. `AC-1` -> `V2`, `V4`
     - Evidence:
       - `gas/Dashboard.html` now defines and invokes:
         - `u1_transport_callServer_`
         - `u1_state_projectMode_`
         - `u1_state_projectOverview_`
         - `u1_render_modePanel_`
         - `u1_render_overviewTable_`
         - `u1_action_wireDashboard_`
       - `node -e "<V2 command>"` exited `0`.
       - `node tests/u1_dashboard_ui_flow_parity.js` exited `0`.
  2. `AC-2` -> `V3`, `V4`
     - Evidence:
       - `node -e "<V3 command>"` exited `0` with empty missing/extra call-name sets.
       - `node tests/u1_dashboard_transport_contracts.js` exited `0`.
  3. `AC-3` -> `V4`
     - Evidence:
       - `node tests/u1_dashboard_ui_flow_parity.js` exited `0`.
       - Verified setup/dashboard transition parity, mode-gated button parity, and representative op reactions for queue / OCR enable / mode change / export / archive flows.
  4. `AC-4` -> `V4`
     - Evidence:
       - `node tests/u1_dashboard_init_race_guard.js` exited `0`.
       - Repeated health application did not duplicate dashboard wiring (single click => single request dispatch).
  5. `AC-5` -> `V1`
     - Evidence:
       - Boundary proof command (V1) executed pre-edit and post-implementation; both exited `0`.
       - No `OUT_OF_SCOPE` and no `FORBIDDEN_EDIT`.
  6. `AC-6` -> `V5`
     - Evidence:
       - `node tests/u1_dashboard_observability_continuity.js` exited `0`.
       - Reaction level/history/current continuity verified for representative success/warn/error paths.
  7. `AC-7` -> `V6`
     - Evidence:
       - `node tests/test_csv_row_regression.js` exited `0`.
       - `npm run typecheck` exited `0`.
       - `npm test` exited `0`.

## TDD Evidence (when applicable)
- Not applicable.
- Spec playbook is `refactor-boundary` (not `tdd-standard`), so Red/Green evidence plan was not required.

## Observability Evidence
- Signals verified:
  1. Signal: client reaction levels (`INFO`, `OK`, `WARN`, `ERROR`) and history/current continuity.
     - Verification command: `node tests/u1_dashboard_observability_continuity.js`
     - Result: pass (exit `0`).
- Waiver (required):
  - `Waiver: No new runtime observability instrumentation is added because U1 is refactor-only decomposition; existing client reaction signals are continuity-verified by V5.`

## Command Log
- Commands run:
  1. V1 boundary proof command (pre-edit)
     - Result: pass (exit `0`)
  2. `node -e "<V2 command>"`
     - Result: pass (exit `0`)
  3. `node -e "<V3 command>"`
     - Result: pass (exit `0`)
  4. `node tests/u1_dashboard_transport_contracts.js`
     - Result: `OK: u1_dashboard_transport_contracts`
  5. `node tests/u1_dashboard_ui_flow_parity.js`
     - Result: `OK: u1_dashboard_ui_flow_parity`
  6. `node tests/u1_dashboard_init_race_guard.js`
     - Result: `OK: u1_dashboard_init_race_guard`
  7. `node tests/u1_dashboard_observability_continuity.js`
     - Result: `OK: u1_dashboard_observability_continuity`
  8. `node tests/test_csv_row_regression.js`
     - Result: `OK: test_csv_row_regression`
  9. `npm run typecheck`
     - Result: pass (exit `0`)
  10. `npm test`
      - Result: pass (exit `0`)

## Diffs
- Key files changed:
  1. `gas/Dashboard.html`
  2. `tests/u1_dashboard_testkit.js`
  3. `tests/u1_dashboard_transport_contracts.js`
  4. `tests/u1_dashboard_ui_flow_parity.js`
  5. `tests/u1_dashboard_init_race_guard.js`
  6. `tests/u1_dashboard_observability_continuity.js`
  7. `.spec/reports/T-20260206-UI-U1-dashboard-script-decomposition-implementation.md`

## Risks / Notes
- Supplemental risks monitored:
  - Client/server contract drift risk reduced via static V3 contract set check.
  - Mode-gate regressions covered by deterministic button-state and flow tests.
  - Init/load-order race risk covered by repeated health-apply wiring test.
- Environment note:
  - `npm run typecheck` initially failed due missing local `tsc`; resolved by running `npm ci`, then re-running V6 checks.

## Hand-off
- Ready for Consult-lane judgement via `$judge` against spec `T-20260206-UI-U1`.
