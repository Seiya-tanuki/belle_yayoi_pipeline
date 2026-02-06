# T-20260206-INTEG-X1: Correlation key normalization across dashboard -> queue -> worker -> export

## Meta
- id: T-20260206-INTEG-X1
- owner_lane: consult -> implement
- risk: high
- playbook: migration-safe
- execution_policy:
  - max_parallel: 1 (serial only)
- scope:
  - allow_edit:
    - gas/DashboardApi.js
    - gas/Queue.js
    - gas/OcrWorkerParallel.js
    - gas/Export.js
    - gas/Config.js
    - tests/x1_*
    - tests/test_dashboard_api_operation_gates.js
    - tests/test_dashboard_api_contract_paths.js
    - tests/test_queue_parity_smoke.js
    - tests/test_export_parity_smoke.js
    - .spec/reports/*
  - forbid_edit:
    - .spec/specs/*
    - .agents/*
    - .lanes/*
    - gas/Dashboard.html
    - gas/Log.js
    - gas/Code.js
    - gas/ExportEntrypoints.js
    - gas/DashboardAuditLog.js
    - gas/DashboardMaintenanceApi.js
    - gas/ExportRunService.js
- web_search: disabled
- decision_refs:
  - none

## Goal
Normalize correlation-key semantics end-to-end for dashboard-triggered operational flow so that dashboard action context and per-item queue/worker/export events can be deterministically joined without breaking existing runtime contracts (`rid`, `run_id`, `file_id`, log sheet schemas, existing API envelopes).

## Non-goals
- No deployment actions (`clasp deploy` and `clasp push` are out of scope).
- No queue/export/log sheet schema expansion (no new required columns in existing sheets).
- No removal of legacy identifiers (`rid`, `run_id`, `file_id`, existing reason/status fields) in this track.
- No edits outside X1 allowlist.
- No cleanup-only destructive migration (Phase D execution is explicitly gated and deferred).

## Context / Constraints
- Runtime behavior change intent: yes (integration observability + correlation normalization).
- X1 is a hot integration track and MUST execute with serial-only implementation flow (`max_parallel = 1`).
- If implementation requires any non-owned path:
  - Stop immediately.
  - Report: `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`
  - Do not continue until consult scope update.
- Compatibility constraints that MUST remain intact:
  - Dashboard API envelope contract (`ok`, `rid`, `action`, `reason`, `message`, `data`) remains backward compatible.
  - Queue row contract/header remains backward compatible.
  - Worker outcome/status/error/retry semantics remain backward compatible.
  - Export behavior and guard contracts remain backward compatible.
  - Existing log sheet headers remain backward compatible.

## Explicit contract additions (migration-safe justified)
- The following additions are allowed and justified for traceability, while preserving all existing fields:
  1. Additive dashboard response metadata under `data`:
     - `corr_action_key` (string)
     - `sample_corr_keys` (array, max length `20`, empty array allowed)
  2. Additive runtime log fields (`corr_action_key`, `corr_key`) on relevant dashboard/queue/worker/export events.
  3. Additive observability counters for missing/invalid/mismatch correlation states.
- No contract removals/renames are allowed in this track.

## Correlation Normalization Contract
- Canonical correlation key format (`corr_key`) for per-item flow:
  - `doc_type + "::" + file_id`
- Canonical action-level key format (`corr_action_key`) for dashboard operation:
  - `action + "::" + rid`
- Bridge requirement for end-to-end joining:
  - Queue operation response includes `sample_corr_keys` derived from queued items (max length `20`).
  - Worker/export item logs must emit `corr_key` that matches those derived item keys (`doc_type::file_id`) for the same items.
- Compatibility rules:
  1. Legacy fields remain emitted and interpreted.
  2. Normalized key is additive in logs/results where feasible.
  3. Read paths use normalized key first only after Phase C gate, with legacy fallback until Phase D.
- Determinism rule:
  - For item logs where both `doc_type` and `file_id` exist, recomputed key MUST equal emitted `corr_key`.

## Migration Plan (phased, reversible)

### Phase A: Compatibility Path Introduction (backward compatible)
- Changes:
  - Introduce shared key builders/normalizers in allowlisted modules.
  - Start dual-emission: legacy IDs + normalized correlation keys.
  - Keep all existing read paths and behavior unchanged.
- Exit criteria:
  - V3, V4, V5 pass with zero regressions.
- Abort criteria:
  - Any contract regression in dashboard envelope, queue/worker statuses, or export guards.
  - Any `corr_key` emission mismatch count > 0 in deterministic tests.
- Rollback:
  - Revert Phase A edits only; rerun V3/V5/V8.

### Phase B: Propagation / Backfill Normalization Path
- Changes:
  - Propagate `corr_key` coverage in queue/worker/export logging paths.
  - Add runtime-safe backfill behavior: when normalized key input is absent, derive from legacy fields deterministically.
  - Add mismatch counters for missing/invalid/derived normalization paths.
- Exit criteria:
  - End-to-end propagation proof (V6) shows dashboard -> queue -> worker -> export continuity with zero mismatch.
- Abort criteria:
  - Missing-key counter > 0 in deterministic propagation test.
  - Cross-stage key inconsistency counter > 0 in deterministic propagation test.
- Rollback:
  - Revert Phase B additions while keeping Phase A compatibility; rerun V4/V5/V6.

### Phase C: Read-path Switch (reversible)
- Changes:
  - Introduce configurable read preference: normalized-first with legacy fallback.
  - Default behavior remains reversible and does not remove legacy fields.
- Exit criteria:
  - Mode-switch parity proof (V7) is green for both compatibility and normalized-first modes.
- Abort criteria:
  - Any mode-switch behavior drift from legacy outcomes/status classifications.
- Rollback:
  - Return read-path mode to compatibility; if needed revert Phase C code only; rerun V7/V8.

### Phase D: Cleanup (post-confirmation only)
- Changes:
  - Remove legacy fallback/read aliases only after explicit consult approval.
- Gate:
  - Not part of this implementation handoff completion.
  - Confirmation criteria (all required before any cleanup spec is drafted/executed):
    1. V4, V5, V6, V7, V8 are green in two consecutive full runs on the same target branch.
    2. Observability counters (missing/invalid/mismatch) remain zero in both runs.
    3. A dependency check report confirms no remaining legacy-only read dependency in owned X1 paths.
    4. Consult lane approval is recorded with report reference.
- Abort criteria:
  - Any unresolved dependency still reading legacy-only identifiers.
- Rollback:
  - Restore compatibility fallback immediately and re-run V7/V8.

## Proposed approach
1. Add deterministic helper(s) in `gas/Config.js` for normalized action/item key composition and safe normalization from legacy fields.
2. Update `gas/DashboardApi.js` to emit normalized action-level correlation context without changing legacy envelope semantics.
3. Update `gas/Queue.js`, `gas/OcrWorkerParallel.js`, and `gas/Export.js` to emit normalized per-item correlation keys in relevant log events and deterministic counters.
4. Preserve all existing contracts by additive behavior only in Phases A-C.
5. Add X1 integration tests (`tests/x1_*`) for deterministic propagation/mismatch assertions and mode-switch parity.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] Scope and serial execution policy are enforceable: X1 changes stay strictly inside allowlist, execution policy is serial-only (`max_parallel = 1`), and scope conflicts hard-stop with `BLOCKER: SCOPE_CONFLICT`.
2. [AC-2] Phase A compatibility is implemented: normalized correlation key emission is additive and legacy contracts remain unchanged.
3. [AC-3] Phase B propagation/backfill is implemented for dashboard -> queue -> worker -> export with deterministic normalization from legacy identifiers when needed.
4. [AC-4] Phase C read-path switch is implemented as reversible normalized-first behavior with legacy fallback retained.
5. [AC-5] Phase D cleanup is explicitly deferred and gated; no irreversible cleanup is executed in this track.
6. [AC-6] Observability is explicit and sufficient: concrete signals, emission points, mismatch counters, thresholds, and abort criteria are implemented and verifiable.
7. [AC-7] Compatibility/parity is preserved for old vs normalized-key behavior (status/reason/outcome and envelope contracts).
8. [AC-8] End-to-end correlation continuity is proven across dashboard -> queue -> worker -> export with zero missing/mismatch in deterministic integration evidence.
9. [AC-9] Repository baseline regressions remain green (`csv/typecheck/npm test`).

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V1, V2 | Boundary proof includes staged/unstaged/untracked coverage; report evidence confirms serial-only execution and conflict-stop protocol. |
| AC-2 | V3, V5 | Compatibility tests confirm additive emission and unchanged legacy contracts. |
| AC-3 | V4, V6 | Propagation/backfill tests show deterministic key derivation and continuity across modules. |
| AC-4 | V7 | Mode-switch tests prove normalized-first read path with legacy fallback parity. |
| AC-5 | V2 | Report explicitly marks Phase D as deferred and not executed. |
| AC-6 | V4, V6 | Observability signal assertions and counters satisfy zero-threshold hard-stop rules. |
| AC-7 | V5, V7 | Old-vs-normalized parity checks remain green. |
| AC-8 | V6 | End-to-end deterministic integration proof shows zero missing/mismatch across all stages. |
| AC-9 | V8 | Baseline commands exit `0`. |

## Verification
1. [V1] Ownership boundary proof (tracked/staged/unstaged/untracked coverage, must pass):
   ```powershell
   $staged = @(git diff --name-only --cached)
   $unstaged = @(git diff --name-only)
   $tracked = @($staged + $unstaged | Sort-Object -Unique)
   $untracked = @(git ls-files --others --exclude-standard)
   $changed = @($tracked + $untracked | Sort-Object -Unique)

   Write-Host "STAGED_COUNT:$($staged.Count)"
   Write-Host "UNSTAGED_COUNT:$($unstaged.Count)"
   Write-Host "TRACKED_COUNT:$($tracked.Count)"
   Write-Host "UNTRACKED_COUNT:$($untracked.Count)"

   $allow = @(
     '^gas/DashboardApi\.js$',
     '^gas/Queue\.js$',
     '^gas/OcrWorkerParallel\.js$',
     '^gas/Export\.js$',
     '^gas/Config\.js$',
     '^tests/x1_.*$',
     '^tests/test_dashboard_api_operation_gates\.js$',
     '^tests/test_dashboard_api_contract_paths\.js$',
     '^tests/test_queue_parity_smoke\.js$',
     '^tests/test_export_parity_smoke\.js$',
     '^\.spec/reports/.*$'
   )

   $ok = $true
   foreach ($f in $changed) {
     $matched = $false
     foreach ($p in $allow) {
       if ($f -match $p) { $matched = $true; break }
     }
     if (-not $matched) {
       Write-Host "OUT_OF_SCOPE:$f"
       $ok = $false
     }
   }

   if (-not $ok) { exit 1 }
   ```
   - Pass criteria: exit `0`; no `OUT_OF_SCOPE`; staged/unstaged/tracked/untracked coverage lines are printed.

2. [V2] Serial execution + phase gate evidence (must pass):
   - Implementation report must include:
     - `Execution policy: max_parallel=1 (serial only)`
     - `Phase A: executed`
     - `Phase B: executed`
     - `Phase C: executed`
     - `Phase D: deferred (not executed)`
     - Conflict protocol statement (`no scope conflict` OR explicit blocker line).
   - Pass criteria: all required lines are present in the X1 implementation report.

3. [V3] Static normalization contract proof (must pass):
   ```powershell
   node -e "const fs=require('fs');const files=['gas/DashboardApi.js','gas/Queue.js','gas/OcrWorkerParallel.js','gas/Export.js','gas/Config.js'];const req=[{file:'gas/Config.js',tokens:['corr_key','corr_action_key']},{file:'gas/DashboardApi.js',tokens:['corr_action_key']},{file:'gas/Queue.js',tokens:['corr_key']},{file:'gas/OcrWorkerParallel.js',tokens:['corr_key']},{file:'gas/Export.js',tokens:['corr_key']}];const miss=[];for(const r of req){const s=fs.readFileSync(r.file,'utf8');for(const t of r.tokens){if(!s.includes(t)) miss.push(r.file+':'+t);}}if(miss.length){console.error('MISSING:'+miss.join(','));process.exit(1);}console.log('OK:X1 static normalization tokens present');"
   ```
   - Pass criteria: command exits `0` and prints `OK:X1 static normalization tokens present`.

4. [V4] Deterministic observability counter tests (must pass):
   ```powershell
   node tests/x1_correlation_observability_counters.js
   ```
   - Required assertions:
     - missing-key counter is `0`.
     - invalid-format counter is `0`.
     - derived-from-legacy counter is deterministic and expected.
     - mismatch counter is `0`.
   - Hard-stop threshold: any counter breach above threshold fails this step.

5. [V5] Compatibility/parity checks (must pass):
   ```powershell
   node tests/test_dashboard_api_operation_gates.js
   node tests/test_dashboard_api_contract_paths.js
   node tests/test_queue_parity_smoke.js
   node tests/test_export_parity_smoke.js
   node tests/x1_correlation_legacy_parity.js
   ```
   - Pass criteria: all commands exit `0`; legacy envelope/status/outcome behavior remains parity-safe.

6. [V6] End-to-end propagation proof (must pass):
   ```powershell
   node tests/x1_correlation_e2e_dashboard_queue_worker_export.js
   ```
   - Required assertions:
     - dashboard action emits action-level normalized correlation key.
     - queue response includes bounded `sample_corr_keys` for trace join.
     - queue, worker, and export item events emit deterministic `corr_key`.
     - the same `doc_type::file_id` key is observed consistently across queue/worker/export for the same item.
     - missing/mismatch counters are `0`.

7. [V7] Reversible read-path switch proof (must pass):
   ```powershell
   node tests/x1_correlation_mode_switch_parity.js
   ```
   - Required assertions:
     - compatibility mode and normalized-first mode both preserve legacy outcomes.
     - fallback from normalized-first to legacy works when normalized key is absent.
     - no irreversible cleanup path is active.

8. [V8] Repository baseline regressions (must pass):
   ```powershell
   node tests/test_csv_row_regression.js
   npm run typecheck
   npm test
   ```
   - Pass criteria: all commands exit `0`.

## Observability Plan
- Waiver: none (runtime behavior changes require observability).

### Signals
1. `X1_CORR_DASH_ACTION`
   - Meaning: dashboard operation emitted action-level normalized key.
   - Emitted from: `gas/DashboardApi.js` wrapper path.
   - Threshold: missing count must be `0` in deterministic tests.
   - Abort: missing count > 0.

2. `X1_CORR_QUEUE_ITEM`
   - Meaning: queue item flow emitted normalized item key.
   - Emitted from: `gas/Queue.js` item claim/process logging path.
   - Threshold: missing or invalid-format count must be `0`.
   - Abort: missing/invalid count > 0.

3. `X1_CORR_WORKER_ITEM`
   - Meaning: worker item flow emitted normalized item key.
   - Emitted from: `gas/OcrWorkerParallel.js` item result logging path.
   - Threshold: mismatch count against recomputed `doc_type::file_id` must be `0`.
   - Abort: mismatch count > 0.

4. `X1_CORR_EXPORT_ITEM`
   - Meaning: export item flow emitted normalized item key.
   - Emitted from: `gas/Export.js` item evaluation/output logging path.
   - Threshold: missing or cross-stage mismatch count must be `0`.
   - Abort: missing/mismatch count > 0.

### Correlation dimensions
- `rid`
- `action`
- `doc_type`
- `file_id`
- `queue_sheet_name`
- `rowIndex` (where available)
- `corr_action_key`
- `corr_key`

### Verification mapping
- V4 validates counters and hard-stop thresholds.
- V6 validates stage-to-stage continuity and key equality.
- V7 validates reversible normalized-first read behavior.

## Safety / Rollback
- Potential failure modes:
  1. Contract drift in dashboard API envelope due additive correlation fields.
  2. Inconsistent correlation key formatting between queue/worker/export.
  3. Read-path switch regressions when normalized key is absent.
  4. Hidden dependency on non-allowlisted files.

- No-go conditions (must stop and escalate):
  1. Any non-owned file is required (`BLOCKER: SCOPE_CONFLICT`).
  2. Any V1 boundary failure.
  3. Any observability hard-stop threshold breach in V4 or V6.
  4. Any compatibility regression in V5 or V7.
  5. Any baseline regression in V8.
- Destructive operations are prohibited in this track (for example: rm -rf, git reset --hard, git clean -fd, clasp deploy).

- Rollback by phase:
  1. Phase A rollback: remove additive correlation emission; keep legacy behavior only; rerun V5/V8.
  2. Phase B rollback: remove propagation/backfill and counters; keep Phase A compatibility; rerun V4/V6/V8.
  3. Phase C rollback: force compatibility read mode and revert switch logic; rerun V7/V8.
  4. Phase D is deferred and must not run in this track.

## Operator-safe rollout notes
1. Execute X1 implementation and verification serially only (`max_parallel=1`).
2. Do not enable cleanup behavior in this track; keep migration reversible through Phase C.
3. Treat any non-zero mismatch/missing counter as hard stop for high-risk integration.
4. For production rollout, perform staged activation:
   - Stage 1: compatibility emission only.
   - Stage 2: propagation/backfill counters active with strict zero-mismatch requirement.
   - Stage 3: normalized-first read mode only after deterministic evidence remains green.
   - Stage 4: cleanup requires separate consult approval and spec.

## Implementation notes (optional)
- Keep normalization logic deterministic and side-effect free.
- Prefer shared helper usage over duplicated key-format logic.
- Avoid schema mutation for queue/export/log sheets in this track.
