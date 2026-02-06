# T-20260206-UI-U1: Dashboard client script decomposition with boundary safety

## Meta
- id: T-20260206-UI-U1
- owner_lane: consult -> implement
- risk: medium
- playbook: refactor-boundary
- scope:
  - allow_edit:
    - gas/Dashboard.html
    - tests/u1_*
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
    - gas/DashboardApi.js
    - gas/Export.js
    - gas/Queue.js
    - gas/OcrWorkerParallel.js
    - gas/DocTypeRegistry.js
    - gas/Config.js
    - gas/Code.js
    - gas/ExportEntrypoints.js
    - gas/Log.js
    - tests/test_dashboard_*
    - tests/t1_*
    - tests/test_reset_headers.js
    - tests/test_doc_type_registry_callsite_smoke.js
- web_search: disabled
- decision_refs:
  - none

## Goal
Refactor only the client-side script inside `gas/Dashboard.html` into explicit internal boundaries (state/model projection, render helpers, action wiring, transport adapter), while preserving `google.script.run` call contracts and UI behavior parity for dashboard setup, mode/operation controls, overview/log refresh, and boot/init sequencing.

## Non-goals
- No new feature behavior, no UI redesign, and no API contract expansion.
- No change to server-side behavior in `gas/DashboardApi.js` or other production modules.
- No edits to existing dashboard test files (`tests/test_dashboard_*`) or any non-U1 test ownership.
- No deployment actions (`clasp deploy` and `clasp push` are out of scope).

## Context / Constraints
- Runtime behavior change intent: no (refactor-only decomposition).
- Exclusive production ownership for U1: `gas/Dashboard.html`.
- Exclusive test ownership for U1: new tests with prefix `tests/u1_*` only.
- If implementation requires editing any non-owned file, stop immediately and report:
  - `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`
- Mandatory preserved client/server call-name contracts from `Dashboard.html`:
  - `belle_dashboard_healthCheck`
  - `belle_dash_getMode`
  - `belle_dash_getOcrRunStatus`
  - `belle_dash_getOverview`
  - `belle_dash_getLogs`
  - `belle_dash_opQueue`
  - `belle_dash_opOcrEnable`
  - `belle_dash_opOcrDisable`
  - `belle_dash_enterMaintenance`
  - `belle_dash_exitMaintenance`
  - `belle_dash_exportRun`
  - `belle_dash_archiveImages`
  - `belle_dash_archiveLogs`
- Supplemental risk notes (non-blocking but tracked):
  1. Client/server contract drift between `Dashboard.html` and `DashboardApi.js`.
  2. Action-button mode-gate regressions in maintenance/OCR flows.
  3. Load-order or script initialization race caused by decomposition.

## Proposed approach
1. Keep all production edits inside `gas/Dashboard.html` and split client logic into explicit helper boundaries:
   - state/model projection boundary (response -> internal state/view model)
   - render boundary (DOM updates only)
   - action wiring boundary (event bindings and button intents)
   - transport adapter boundary (`google.script.run` adapter + callback normalization)
   - required boundary helper names (deterministic proof anchors):
     - `u1_transport_callServer_`
     - `u1_state_projectMode_`
     - `u1_state_projectOverview_`
     - `u1_render_modePanel_`
     - `u1_render_overviewTable_`
     - `u1_action_wireDashboard_`
2. Preserve current top-level runtime shape:
   - existing button IDs and DOM element IDs remain compatible
   - existing boot path (`DOMContentLoaded` -> `boot`) remains intact
3. Add deterministic U1-owned tests (`tests/u1_*`) to prove parity for:
   - API call-name contract set
   - mode-gated button enable/disable behavior
   - init/load-order sequencing and representative action flows

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] `gas/Dashboard.html` is decomposed into explicit internal boundaries for state/model projection, render helpers, action wiring, and transport adapter; refactor remains single-file for production code and includes required helper anchors:
   - `u1_transport_callServer_`
   - `u1_state_projectMode_`
   - `u1_state_projectOverview_`
   - `u1_render_modePanel_`
   - `u1_render_overviewTable_`
   - `u1_action_wireDashboard_`
2. [AC-2] Existing `google.script.run` call-name contracts are preserved exactly (no missing/renamed call names and no accidental extra dashboard client call names).
3. [AC-3] UI behavior parity is preserved for deterministic flows:
   - setup view vs dashboard view transition from health-check result,
   - mode-driven button enable/disable behavior for OCR vs MAINTENANCE,
   - representative operation flows (`queue`, `ocr enable/disable`, `mode change`, `export run`, `archive logs/images`) keep existing success/error/warn reaction behavior.
4. [AC-4] Load-order and initialization safety is preserved:
   - `DOMContentLoaded` boot path remains active,
   - dashboard initialization does not double-wire handlers under repeated health application.
5. [AC-5] Boundary safety is enforced:
   - all edits remain within U1 ownership (`gas/Dashboard.html`, `tests/u1_*`),
   - forbidden files remain untouched,
   - if non-owned edit is required, work stops with `BLOCKER: SCOPE_CONFLICT`.
6. [AC-6] Observability handling is explicit:
   - no new runtime observability signals are introduced (waiver for new instrumentation),
   - continuity proof exists for existing client reaction/log signaling behavior when decomposition changes code paths.
7. [AC-7] Repository baseline regression commands remain green.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V2, V4 | Static decomposition proof and U1 decomposition/parity tests pass with explicit boundary helpers present. |
| AC-2 | V3, V4 | Static contract check confirms preserved call-name set; U1 transport-contract test validates adapter behavior for success/failure callback routing. |
| AC-3 | V4 | U1 UI-flow tests assert deterministic mode gating and operation reaction parity. |
| AC-4 | V4 | U1 init/load-order test asserts single boot wiring and no duplicate initialization effects. |
| AC-5 | V1 | Ownership proof exits `0` with no `OUT_OF_SCOPE`/`FORBIDDEN_EDIT` entries. |
| AC-6 | V5 | Observability waiver is explicit; continuity test proves existing reaction signal mapping parity. |
| AC-7 | V6 | Baseline regression commands exit `0`. |

## Verification
1. [V1] Ownership and forbidden-file boundary proof (must pass):
   ```powershell
   $tracked = @(git diff --name-only HEAD)
   $untracked = @(git ls-files --others --exclude-standard)
   $changed = @($tracked + $untracked | Sort-Object -Unique)
   $ok = $true

   foreach ($f in $changed) {
     if ($f -eq 'gas/Dashboard.html') { continue }
     if ($f -like 'tests/u1_*') { continue }
     if ($f -like '.spec/reports/*') { continue }
     Write-Host "OUT_OF_SCOPE:$f"
     $ok = $false
   }

   $forbidden = @(
     '^\.spec/specs/.*$',
     '^\.agents/.*$',
     '^\.lanes/.*$',
     '^gas/DashboardApi\.js$',
     '^gas/Export\.js$',
     '^gas/Queue\.js$',
     '^gas/OcrWorkerParallel\.js$',
     '^gas/DocTypeRegistry\.js$',
     '^gas/Config\.js$',
     '^gas/Code\.js$',
     '^gas/ExportEntrypoints\.js$',
     '^gas/Log\.js$',
     '^tests/test_dashboard_.*\.js$',
     '^tests/t1_.*\.js$',
     '^tests/test_reset_headers\.js$',
     '^tests/test_doc_type_registry_callsite_smoke\.js$'
   )

   foreach ($f in $changed) {
     foreach ($p in $forbidden) {
       if ($f -match $p) {
         Write-Host "FORBIDDEN_EDIT:$f"
         $ok = $false
       }
     }
   }

   if (-not $ok) { exit 1 }
   ```
   - Pass criteria: exit `0`; no `OUT_OF_SCOPE` and no `FORBIDDEN_EDIT`.

2. [V2] Dashboard decomposition boundary proof (must pass):
   ```powershell
   node -e "const fs=require('fs');const html=fs.readFileSync('gas/Dashboard.html','utf8');const script=(html.match(/<script>\\s*\\(function \\(\\) \\{[\\s\\S]*?\\}\\)\\(\\);\\s*<\\/script>/)||[])[0]||'';const required=['u1_transport_callServer_','u1_state_projectMode_','u1_state_projectOverview_','u1_render_modePanel_','u1_render_overviewTable_','u1_action_wireDashboard_'];const defs=[...script.matchAll(/function\\s+([A-Za-z0-9_]+)\\s*\\(/g)].map(m=>m[1]);const missing=required.filter(n=>!defs.includes(n));const missingCalls=required.filter(n=>script.indexOf(n+'(')<0);if(missing.length||missingCalls.length){console.error(JSON.stringify({missing,missingCalls,defs},null,2));process.exit(1);}"
   ```
   - Pass criteria: exit `0`; required U1 helper anchors exist and are invoked in `gas/Dashboard.html`.

3. [V3] Static `google.script.run` call-name contract check (must pass):
   ```powershell
   node -e "const fs=require('fs');const html=fs.readFileSync('gas/Dashboard.html','utf8');const names=new Set();for(const m of html.matchAll(/callServer\\(\"([A-Za-z0-9_]+)\"/g)){names.add(m[1]);}for(const m of html.matchAll(/runOp\\([^,]+,\\s*\"([A-Za-z0-9_]+)\"/g)){names.add(m[1]);}const expected=['belle_dashboard_healthCheck','belle_dash_getMode','belle_dash_getOcrRunStatus','belle_dash_getOverview','belle_dash_getLogs','belle_dash_opQueue','belle_dash_opOcrEnable','belle_dash_opOcrDisable','belle_dash_enterMaintenance','belle_dash_exitMaintenance','belle_dash_exportRun','belle_dash_archiveImages','belle_dash_archiveLogs'];const missing=expected.filter(n=>!names.has(n));const extra=[...names].filter(n=>!expected.includes(n));if(missing.length||extra.length){console.error(JSON.stringify({missing,extra,names:[...names].sort()},null,2));process.exit(1);}"
   ```
   - Pass criteria: exit `0`; missing/extra sets are empty.

4. [V4] Deterministic U1-owned UI-flow checks (must pass):
   ```powershell
   node tests/u1_dashboard_transport_contracts.js
   node tests/u1_dashboard_ui_flow_parity.js
   node tests/u1_dashboard_init_race_guard.js
   ```
   - Required assertions across these tests:
     - transport adapter routes success/failure callbacks deterministically and preserves payload/no-payload invocation shape.
     - setup/dashboard view switching parity from ready/not-ready health outcomes.
     - OCR vs MAINTENANCE mode button enabled-state parity.
     - representative action flows preserve success/warn/error reaction behavior for existing reason categories (`MODE_NOT_*`, `TRIGGERS_ACTIVE`, `LIVE_PROCESSING`, `OCR_ENABLE_BLOCKED`).
     - repeated health application does not double-initialize dashboard event wiring.

5. [V5] Observability waiver and continuity proof (must pass):
   ```powershell
   node tests/u1_dashboard_observability_continuity.js
   ```
   - Pass criteria:
     - test confirms existing reaction-level mapping and history/current message behavior parity for representative success/warn/error paths.
     - no new client telemetry/log signal category is introduced.
   - Waiver requirement (must be recorded in implementation report):
     - `Waiver: No new runtime observability instrumentation is added because U1 is refactor-only decomposition; existing client reaction signals are continuity-verified by V5.`

6. [V6] Repository baseline regression checks (must pass):
   ```powershell
   node tests/test_csv_row_regression.js
   npm run typecheck
   npm test
   ```
   - Pass criteria: all commands exit `0`.

## Observability Plan
- Runtime observability expansion: no (refactor-only).
- Existing client reaction signals to preserve:
  - level semantics used by `rxSetCurrent` / `rxPush` (`INFO`, `OK`, `WARN`, `ERROR`)
  - action-failure classification semantics in `runOp` for blocked vs failed outcomes
- Emission points:
  - client reaction rendering paths in `gas/Dashboard.html` (`rxSetCurrent`, `rxPush`, operation handlers)
- Correlation dimensions:
  - action label, reason code, level, message branch (success/warn/error)
- Verification mapping:
  - V4 covers representative behavior branches and mode-gated flows.
  - V5 proves continuity of reaction signal behavior.
- Waiver:
  - `No new observability signals are introduced; decomposition only preserves existing signals.`

## Safety / Rollback
- Potential failure modes:
  1. Client/server call-name drift breaks runtime calls.
  2. Mode-gate button behavior regression between OCR and MAINTENANCE.
  3. Decomposition introduces initialization/load-order race (double handlers, duplicate requests).
- No-go conditions (must stop and escalate):
  1. Any required change outside U1 ownership (`BLOCKER: SCOPE_CONFLICT`).
  2. Any V1 boundary proof failure.
  3. Any V3 contract check failure (missing/extra call names).
  4. Any V4/V5 deterministic parity assertion failure.
  5. Any baseline regression failure in V6.
- Rollback plan:
  1. Revert only U1-scope edits (`gas/Dashboard.html`, `tests/u1_*`).
  2. Re-run V3, V4, V5, and V6 to confirm parity restoration.
  3. Re-apply decomposition in smaller slices:
     - transport adapter extraction
     - state/model projection extraction
     - render helper extraction
     - action wiring extraction
     validating V3/V4/V5 after each slice.

## Implementation notes (optional)
- Keep all new helper functions inside the existing dashboard IIFE in `gas/Dashboard.html`.
- Required helper anchors for boundary safety must be kept as named functions:
  - `u1_transport_callServer_`
  - `u1_state_projectMode_`
  - `u1_state_projectOverview_`
  - `u1_render_modePanel_`
  - `u1_render_overviewTable_`
  - `u1_action_wireDashboard_`
- Do not rename DOM IDs used by existing markup/buttons.
- Keep `google.script.run` transport usage behind one adapter boundary so static contract checks remain deterministic.
- New tests must be deterministic and self-contained (Node + VM/fake DOM, no network, no timers requiring wall-clock waits).
