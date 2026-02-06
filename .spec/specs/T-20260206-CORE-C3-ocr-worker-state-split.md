# T-20260206-CORE-C3: OCR worker state-transition decomposition with boundary safety

## Meta
- id: T-20260206-CORE-C3
- owner_lane: consult -> implement
- risk: high
- playbook: refactor-boundary
- scope:
  - allow_edit:
    - gas/OcrWorkerParallel.js
    - tests/test_ocr_worker_orchestrator_boundaries.js
    - tests/test_ocr_worker_dispatch_parity.js
    - tests/test_ocr_worker_no_target.js
    - tests/test_ocr_parallel_stagger.js
    - tests/test_ocr_parallel_disable.js
    - tests/test_worker_pipeline_kind_parity.js
    - tests/c3_*
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
    - gas/Export.js
    - gas/Queue.js
    - gas/Dashboard*
    - gas/DocTypeRegistry.js
    - gas/Config.js
    - gas/Code.js
    - gas/ExportEntrypoints.js
    - gas/Log.js
    - tests/test_reset_headers.js
    - tests/test_doc_type_registry_callsite_smoke.js
    - tests/test_queue_*
    - tests/test_export_*
    - tests/test_ocr_reap_stale.js
    - tests/test_ocr_claim_headers.js
    - tests/test_ocr_claim_cursor.js
- web_search: disabled
- decision_refs:
  - none

## Goal
Refactor `belle_ocr_workerOnce_` inside `gas/OcrWorkerParallel.js` into explicit internal state-transition boundaries for claim/attempt initialization, pipeline dispatch adapter, error classification + retry decision, writeback commit, and telemetry/perf projection, while preserving existing OCR worker behavior contracts and observability continuity.

## Non-goals
- No runtime feature expansion and no new product behavior.
- No change to public/global OCR entrypoint names (`belle_ocr_workerOnce_`, `belle_ocr_workerLoop_`, `belle_ocr_worker_dispatchByPipelineKind_`, perf append helpers).
- No change to queue schema contracts or field meaning.
- No edits outside C3-owned files.
- No deployment actions (`clasp deploy` and `clasp push` are out of scope).

## Context / Constraints
- Runtime behavior change intent: no (extraction-first refactor only).
- C3 exclusive production ownership: `gas/OcrWorkerParallel.js`.
- C3 exclusive existing test ownership:
  - `tests/test_ocr_worker_orchestrator_boundaries.js`
  - `tests/test_ocr_worker_dispatch_parity.js`
  - `tests/test_ocr_worker_no_target.js`
  - `tests/test_ocr_parallel_stagger.js`
  - `tests/test_ocr_parallel_disable.js`
  - `tests/test_worker_pipeline_kind_parity.js`
- New C3 tests may only use prefix `tests/c3_*`.
- If implementation requires any non-owned file edit, stop immediately and report:
  - `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`
- Behavior contracts that must remain intact:
  - reason/status outcomes (including `NO_TARGET`, `LOCK_BUSY`, `CLAIM_LOST`, `DONE`, `QUEUED`, `ERROR_RETRYABLE`, `ERROR_FINAL` paths).
  - error write semantics for `ocr_error_code` and `ocr_error_detail`.
  - retry metadata semantics for retry_count / next_retry_at (`ocr_attempts`, `ocr_next_retry_at_iso`).
  - perf-log row layout contract driven by `belle_perf_getHeaderV2_` + `belle_perf_buildRowV2_`.
- Supplemental risk notes (non-blocking but must be tracked):
  1. Queue-worker contract drift via implicit `PROCESSING` lock assumptions.
  2. Perf log schema/layout drift caused by helper extraction.
  3. Queue/OCR worker load-order regression due boundary movement.

## Proposed approach
1. Keep all production changes local to `gas/OcrWorkerParallel.js`.
2. Introduce explicit helper boundaries with `belle_ocr_worker_state_*_` naming for the five required concerns:
   - claim validation + attempt initialization
   - pipeline dispatch / run-once adapter
   - error classification + retry/backoff decision
   - writeback commit path
   - telemetry/perf projection
3. Keep `belle_ocr_workerOnce_` as orchestration glue that calls these boundaries in deterministic order.
4. Add deterministic C3 tests (`tests/c3_*`) for claim-lost and writeback/error branches, including branch-level observability and retry metadata assertions.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] `belle_ocr_workerOnce_` is decomposed into explicit `belle_ocr_worker_state_*_` boundaries for the five required concerns, with no cross-file production extraction.
2. [AC-2] Worker behavior contracts remain parity:
   - existing reason/status outcomes remain consistent,
   - claim-lost handling remains consistent in both pre-dispatch and pre-commit lock revalidation paths,
   - existing dispatch behavior by pipeline kind remains unchanged.
3. [AC-3] Writeback/error contracts remain parity:
   - `ocr_error_code` and `ocr_error_detail` write semantics unchanged,
   - retry metadata semantics unchanged for retryable/final outcomes (`ocr_attempts`, `ocr_next_retry_at_iso`),
   - legacy `LEGACY_ERROR_IN_OCR_JSON` normalization behavior remains intact.
4. [AC-4] Telemetry/perf projection contracts remain intact:
   - worker summary projection fields remain compatible with perf row layout expectations,
   - `test_perf_log_v2` contract remains green.
5. [AC-5] Observability continuity is proven without waiver:
   - continuity of `OCR_ITEM_START`, `OCR_ITEM_DONE`, `OCR_ITEM_ERROR` signals is preserved,
   - branch-level assertions prove error/retry field continuity on success and error paths.
6. [AC-6] Boundary safety is enforced:
   - all changes stay within C3 ownership,
   - forbidden files remain untouched,
   - if a non-owned file is required, implementation stops with `BLOCKER: SCOPE_CONFLICT`.
7. [AC-7] Repo baseline regressions remain green.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V2, V4 | Static helper-boundary proof shows explicit `belle_ocr_worker_state_*_` decomposition; C3 transition test passes after refactor. |
| AC-2 | V3, V4 | Existing OCR worker parity tests and new transition branches remain green with unchanged outcomes. |
| AC-3 | V4, V6 | C3 transition assertions prove writeback/error/retry field continuity; observability continuity proof stays green. |
| AC-4 | V5 | Perf row layout contract (`test_perf_log_v2`) and summary projection checks pass. |
| AC-5 | V6 | Static and dynamic observability proofs confirm `OCR_ITEM_START/DONE/ERROR` continuity and branch-level error/retry assertions. |
| AC-6 | V1 | Ownership/forbidden boundary scripts pass; no out-of-scope edits; blocker protocol explicitly enforced. |
| AC-7 | V7 | Baseline regression commands all exit `0`. |

## Verification
1. [V1] Ownership and forbidden-file boundary proof (must pass):
   ```powershell
   $tracked = @(git diff --name-only HEAD)
   $untracked = @(git ls-files --others --exclude-standard)
   $changed = @($tracked + $untracked | Sort-Object -Unique)
   $ok = $true
   foreach ($f in $changed) {
     if ($f -eq 'gas/OcrWorkerParallel.js') { continue }
     if ($f -eq 'tests/test_ocr_worker_orchestrator_boundaries.js') { continue }
     if ($f -eq 'tests/test_ocr_worker_dispatch_parity.js') { continue }
     if ($f -eq 'tests/test_ocr_worker_no_target.js') { continue }
     if ($f -eq 'tests/test_ocr_parallel_stagger.js') { continue }
     if ($f -eq 'tests/test_ocr_parallel_disable.js') { continue }
     if ($f -eq 'tests/test_worker_pipeline_kind_parity.js') { continue }
     if ($f -like 'tests/c3_*') { continue }
     if ($f -like '.spec/reports/*') { continue }
     Write-Host "OUT_OF_SCOPE:$f"
     $ok = $false
   }

   $forbidden = @(
     '^gas/Export\.js$',
     '^gas/Queue\.js$',
     '^gas/Dashboard.*$',
     '^gas/DocTypeRegistry\.js$',
     '^gas/Config\.js$',
     '^gas/Code\.js$',
     '^gas/ExportEntrypoints\.js$',
     '^gas/Log\.js$',
     '^tests/test_reset_headers\.js$',
     '^tests/test_doc_type_registry_callsite_smoke\.js$',
     '^tests/test_queue_.*\.js$',
     '^tests/test_export_.*\.js$',
     '^tests/test_ocr_reap_stale\.js$',
     '^tests/test_ocr_claim_headers\.js$',
     '^tests/test_ocr_claim_cursor\.js$'
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
   - Pass criteria: exit `0`; no `OUT_OF_SCOPE` or `FORBIDDEN_EDIT` output; tracked/staged/unstaged/untracked changes are all covered.

2. [V2] Worker decomposition boundary proof (must pass):
   ```powershell
   node -e "const fs=require('fs');const code=fs.readFileSync('gas/OcrWorkerParallel.js','utf8');const defs=[...code.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)].map(m=>m[1]);const required=['belle_ocr_worker_state_prepareClaim_','belle_ocr_worker_state_dispatchRunOnce_','belle_ocr_worker_state_classifyError_','belle_ocr_worker_state_commitWriteback_','belle_ocr_worker_state_projectTelemetry_'];const missing=required.filter(n=>!defs.includes(n));const start=code.indexOf('function belle_ocr_workerOnce_(');const end=code.indexOf('function belle_ocr_workerLoop_(');const body=(start>=0&&end>start)?code.slice(start,end):'';const missingCalls=required.filter(n=>body.indexOf(n+'(')<0);if(missing.length||missingCalls.length){console.error(JSON.stringify({missing,missingCalls},null,2));process.exit(1);}"
   ```
   - Pass criteria: command exits `0`; helper boundaries exist and are referenced by `belle_ocr_workerOnce_`.

3. [V3] Existing worker-focused parity checks (must pass):
   ```powershell
   node tests/test_ocr_worker_orchestrator_boundaries.js
   node tests/test_ocr_worker_dispatch_parity.js
   node tests/test_ocr_worker_no_target.js
   node tests/test_ocr_parallel_stagger.js
   node tests/test_ocr_parallel_disable.js
   node tests/test_worker_pipeline_kind_parity.js
   ```
   - Pass criteria: all commands exit `0`.

4. [V4] New deterministic C3 state-transition test (must pass):
   ```powershell
   node tests/c3_ocr_worker_state_transitions.js
   ```
   - Required assertions in this test:
     - claim-lost branch parity (pre-dispatch lock revalidation and pre-commit lock revalidation).
     - writeback success branch parity (`DONE`/`QUEUED` clears error fields and retry timestamp).
     - writeback error branch parity (`ERROR_RETRYABLE`/`ERROR_FINAL` writes `ocr_error_code`, `ocr_error_detail`, retry timestamp semantics, JSON keep/clear semantics).
     - legacy error normalization parity for `LEGACY_ERROR_IN_OCR_JSON` path.

5. [V5] Telemetry/perf projection proof (must pass):
   ```powershell
   node tests/c3_ocr_worker_summary_projection.js
   node tests/test_perf_log_v2.js
   ```
   - Pass criteria:
     - summary projection test proves `belle_ocr_workerLoop_` aggregate fields (`processed`, `done`, `errors`, `retryable`, `final`, latency aggregates, `processingCount`) remain deterministic.
     - `test_perf_log_v2.js` confirms PERF_LOG header/row layout contract remains intact.

6. [V6] Observability continuity proof (must pass, no waiver):
   ```powershell
   rg -n 'phase:\s*"OCR_ITEM_START"|phase:\s*"OCR_ITEM_DONE"|phase:\s*"OCR_ITEM_ERROR"' gas/Queue.js
   node tests/c3_ocr_worker_state_transitions.js
   ```
   - Pass criteria:
     - static proof keeps `OCR_ITEM_START`, `OCR_ITEM_DONE`, `OCR_ITEM_ERROR` literals present.
     - dynamic C3 assertions prove branch-level continuity of error/retry writes (`ocr_error_code`, `ocr_error_detail`, `ocr_next_retry_at_iso`) aligned with success/error outcomes.

7. [V7] Repository baseline regression checks (must pass):
   ```powershell
   node tests/test_csv_row_regression.js
   npm run typecheck
   npm test
   ```
   - Pass criteria: all commands exit `0`.

## Observability Plan
- Waiver: none.
- Signals to preserve:
  - `OCR_ITEM_START`
  - `OCR_ITEM_DONE`
  - `OCR_ITEM_ERROR`
- Error/retry observability fields to preserve:
  - `ocr_error_code`
  - `ocr_error_detail`
  - `ocr_next_retry_at_iso`
  - `ocr_attempts` (retry_count semantics)
- Emission/write points:
  - OCR item phase logs in queue OCR item processing path (`gas/Queue.js`).
  - OCR worker writeback path in `gas/OcrWorkerParallel.js` for status/error/retry fields.
- Correlation keys/dimensions:
  - `file_id`, `rowIndex/row`, `docType/doc_type`, `statusOut/outcome`, `attempt`.
- Verification mapping:
  - V4 validates branch-level field-write continuity.
  - V6 validates phase-signal continuity + branch-level error/retry continuity.
  - V5 validates telemetry/perf projection continuity for summary -> PERF_LOG contract.

## Safety / Rollback
- Potential failure modes:
  - claim ownership revalidation drift leading to false writeback (`CLAIM_LOST` contract break).
  - retry/error field drift (`ocr_error_code`, `ocr_error_detail`, `ocr_next_retry_at_iso`, `ocr_attempts`).
  - helper extraction drift in telemetry projection causing PERF_LOG contract mismatch.
  - load-order regressions between queue and OCR worker modules.
- No-go conditions (must stop and escalate):
  1. Any non-owned file edit is required to complete C3 (`BLOCKER: SCOPE_CONFLICT`).
  2. Any V1 boundary proof failure.
  3. Any V4/V5/V6 contract assertion failure.
  4. Any behavior change requiring intentional contract expansion.
- Rollback plan:
  1. Revert only C3-scoped edits (`gas/OcrWorkerParallel.js`, allowed worker tests, `tests/c3_*`).
  2. Re-run V3, V4, V5, and V7 to confirm parity restoration.
  3. Re-apply extraction in smaller slices (prepare-claim -> dispatch -> classify -> commit -> telemetry), validating V2/V4 after each slice.

## Implementation notes (optional)
- Keep new helper boundaries in `gas/OcrWorkerParallel.js`; do not move behavior into other production modules.
- Keep top-level helper naming under `belle_ocr_worker_state_*_` for deterministic boundary proofs.
- New C3 tests must remain deterministic (no network calls, no nondeterministic timers).
