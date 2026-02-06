# T-20260206-CORE-C1: Export core skeleton extraction with boundary safety

## Meta
- id: T-20260206-CORE-C1
- owner_lane: consult -> implement
- risk: medium
- playbook: refactor-boundary
- scope:
  - allow_edit:
    - gas/Export.js
    - tests/test_export_*
    - tests/c1_*
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
- web_search: disabled
- decision_refs:
  - none

## Goal
Extract duplicated export core skeleton logic from the three doc-type internal flows in `gas/Export.js` into shared internal helper layers, while preserving runtime behavior, output contracts, and existing entrypoint behavior.

## Non-goals
- No product feature additions or contract expansion.
- No change to global/public export entrypoint names or callsites.
- No edits outside C1 ownership scope.
- No deployment actions (`clasp deploy` and `clasp push` are out of scope).

## Context / Constraints
- Runtime behavior change intent: no (refactor-only extraction).
- Current duplication exists across:
  - `belle_exportYayoiCsvReceiptInternal_`
  - `belle_exportYayoiCsvBankStatementInternal_`
  - `belle_exportYayoiCsvCcStatementInternal_`
  Shared repeated blocks include guard counting, queue preflight guards, export log preparation/guard, and skip-log flush scaffolding.
- Mandatory conflict-prevention constraints:
  1. Exclusive production ownership for C1 is `gas/Export.js`.
  2. Exclusive test ownership is existing `tests/test_export_*` plus new C1 tests with prefix `tests/c1_*`.
  3. Forbidden edits:
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
      - `tests/test_queue_*`
- Implementation must run on a dedicated C1 branch/worktree so boundary proofs evaluate track-local diffs only.

## Proposed approach
1. Keep doc-type specific row-build and validation logic in each existing doc-type function.
2. Introduce shared skeleton helpers in `gas/Export.js` (top-level private helpers with suffix `_`) for:
   - guard-count serialization and guard-log append wiring,
   - queue/preflight guard checks (`FISCAL_RANGE_INVALID`, `QUEUE_SHEET_NOT_FOUND`, `NO_ROWS`, invalid header, pending/retryable guards),
   - export-log setup and schema guard handling,
   - common runtime state setup (processed/importSet/skip-flush state),
   - common finalization (`NO_EXPORT_ROWS` vs CSV creation path result shaping).
3. Keep all existing top-level function names in `gas/Export.js` intact and introduce any new top-level helpers only with prefix `belle_export_skeleton_`.
4. Add targeted C1 observability continuity tests under `tests/c1_*` if existing export tests do not deterministically prove all required phase paths.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] Extraction-first refactor is completed in `gas/Export.js` by consolidating shared skeleton blocks used by receipt/cc/bank internal flows into shared `belle_export_skeleton_*` helpers, while preserving each flow's doc-type specific conversion logic. Legacy duplicated local helper declarations (`buildCountsJson`, `logGuard`, `flushSkipDetails`) are removed from doc-type function bodies.
2. [AC-2] Export contracts are preserved:
   - existing entrypoint behavior remains unchanged,
   - guard/done/error outcomes preserve existing reason/shape expectations as validated by export-focused tests.
3. [AC-3] C1 boundary safety is preserved:
   - code changes are limited to `gas/Export.js` and allowed tests,
   - forbidden files remain untouched,
   - no new top-level export helper names are introduced except `belle_export_skeleton_*`.
4. [AC-4] Observability continuity is explicitly proven for existing export phase signals:
   - `EXPORT_GUARD`
   - `EXPORT_DONE`
   - `EXPORT_ERROR`
   using deterministic tests and/or deterministic signal assertions.
5. [AC-5] Regression/parity remains green:
   - all `tests/test_export_*` pass,
   - baseline repo checks (`test_csv_row_regression`, `typecheck`, full `npm test`) pass.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V2, V3 | Static boundary checks confirm allowed helper namespace and no forbidden signature drift; export-focused tests remain green after extraction. |
| AC-2 | V3, V5 | Existing export suite and full repo checks pass with unchanged behavior contracts. |
| AC-3 | V1, V2 | Ownership/path proof passes; forbidden files unchanged; top-level function-name policy proof passes. |
| AC-4 | V4 | Deterministic signal continuity proof shows reachable/validated `EXPORT_GUARD`, `EXPORT_DONE`, `EXPORT_ERROR` paths. |
| AC-5 | V3, V5 | Export parity plus baseline regression commands all exit `0`. |

## Verification
1. [V1] Ownership and forbidden-file boundary proof (must pass):
   - Command:
     ```powershell
     $changed = @(git diff --name-only -- gas tests .spec/reports)
     $ok = $true
     foreach ($f in $changed) {
       if ($f -eq 'gas/Export.js') { continue }
       if ($f -like 'tests/test_export_*') { continue }
       if ($f -like 'tests/c1_*') { continue }
       if ($f -like '.spec/reports/*') { continue }
       Write-Host "OUT_OF_SCOPE:$f"
       $ok = $false
     }

     $forbidden = @(
       '^gas/Queue\.js$',
       '^gas/OcrWorkerParallel\.js$',
       '^gas/Dashboard.*$',
       '^gas/DocTypeRegistry\.js$',
       '^gas/Config\.js$',
       '^gas/Code\.js$',
       '^gas/ExportEntrypoints\.js$',
       '^gas/Log\.js$',
       '^tests/test_reset_headers\.js$',
       '^tests/test_doc_type_registry_callsite_smoke\.js$',
       '^tests/test_queue_.*\.js$'
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
   - Pass criteria: script exits `0`; no `OUT_OF_SCOPE` or `FORBIDDEN_EDIT` lines.

2. [V2] Signature and helper-namespace boundary proof (must pass):
   - Command:
     ```powershell
     node tests/test_export_module_boundaries.js

     node -e "const fs=require('fs');const code=fs.readFileSync('gas/Export.js','utf8');const defs=[...code.matchAll(/^function\\s+([A-Za-z0-9_]+)\\s*\\(/gm)].map(m=>m[1]);const baseline=['belle_getExportLogHeaderColumns','belle_getOrCreateExportLogSheet','belle_exportLog_buildSchemaMismatchDetail_','belle_export_pickSingleFolder_','belle_export_resolveOutputFolderByDocType_','belle_export_runDocTypesInternal_','belle_export_getHandlersByRegistry_','belle_exportYayoiCsvInternal_','belle_exportYayoiCsvReceiptInternal_','belle_exportYayoiCsvBankStatementInternal_','belle_exportYayoiCsvCcStatementInternal_','belle_exportYayoiCsvInternalFromEntrypoints_'];const missing=baseline.filter(n=>!defs.includes(n));const added=defs.filter(n=>!baseline.includes(n));const bad=added.filter(n=>!/^belle_export_skeleton_[A-Za-z0-9_]+_$/.test(n));const leftovers=['function buildCountsJson(','function logGuard(','function flushSkipDetails('].filter(s=>code.includes(s));const segments=[['belle_exportYayoiCsvReceiptInternal_','function belle_exportYayoiCsvBankStatementInternal_('],['belle_exportYayoiCsvBankStatementInternal_','function belle_exportYayoiCsvCcStatementInternal_('],['belle_exportYayoiCsvCcStatementInternal_','function belle_exportYayoiCsvInternalFromEntrypoints_(']];const missingSkeletonUse=[];for(const seg of segments){const start=code.indexOf('function '+seg[0]+'(');const end=code.indexOf(seg[1]);if(start<0||end<0||end<=start){missingSkeletonUse.push(seg[0]);continue;}const body=code.slice(start,end);if(!/belle_export_skeleton_[A-Za-z0-9_]+_/.test(body)){missingSkeletonUse.push(seg[0]);}}if(missing.length||bad.length||leftovers.length||missingSkeletonUse.length){console.error(JSON.stringify({missing,bad,added,leftovers,missingSkeletonUse},null,2));process.exit(1);}"
     ```
   - Pass criteria: both commands exit `0`; baseline names remain; any newly added top-level helper names are only `belle_export_skeleton_*`; legacy duplicated local helper declarations are absent; each doc-type function body references at least one `belle_export_skeleton_*` helper.

3. [V3] Export-focused parity/regression checks (must pass):
   - Command:
     ```powershell
     node -e "const fs=require('fs');const cp=require('child_process');const tests=fs.readdirSync('tests').filter(f=>/^test_export_.*\.js$/.test(f)).sort();for(const t of tests){const r=cp.spawnSync(process.execPath,['tests/'+t],{stdio:'inherit'});if(r.status!==0)process.exit(r.status);}"
     ```
   - Pass criteria: command exits `0`; all existing `test_export_*` pass.

4. [V4] Observability continuity proof for export phase signals (must pass):
   - Command:
     ```powershell
     rg -n 'phase:\s*"EXPORT_GUARD"|phase:\s*"EXPORT_DONE"|phase:\s*"EXPORT_ERROR"' gas/Export.js

     node tests/c1_export_signal_continuity.js
     ```
   - Pass criteria:
     - `rg` output includes all three signal literals.
     - `tests/c1_export_signal_continuity.js` exits `0` and deterministically verifies representative paths for `EXPORT_GUARD`, `EXPORT_DONE`, and `EXPORT_ERROR`.

5. [V5] Repository regression checks (must pass):
   - Command:
     ```powershell
     node tests/test_csv_row_regression.js
     npm run typecheck
     npm test
     ```
   - Pass criteria: all commands exit `0`.

## Observability Plan
- Runtime behavior change intent: no.
- Required continuity proof (not waived): keep existing export phase signals and validate them deterministically.
- Signals:
  - `phase: "EXPORT_GUARD"`
  - `phase: "EXPORT_DONE"`
  - `phase: "EXPORT_ERROR"`
- Emission points:
  - Guard and done result logs in doc-type internal export flows in `gas/Export.js`.
  - Error logs in `catch` branches in doc-type internal export flows / orchestration error handling.
- Correlation dimensions:
  - `doc_type`, `reason`, `csvFileId` (when present), plus `ok` flag.
- Verification mapping:
  - V4 proves signal continuity directly.
  - V3/V5 ensure no parity regression while preserving signal contracts.

## Safety / Rollback
- Potential failure modes:
  - Behavior drift while extracting shared skeleton blocks.
  - Accidental scope leak to forbidden modules/tests.
  - Hidden contract drift in guard/done/error result shapes.
- Mitigations:
  - Keep extraction incremental and run V2/V3 after each logical extraction step.
  - Enforce ownership checks (V1) before finalizing.
  - Require observability continuity proof (V4) before handoff.
- Rollback plan:
  1. Revert C1 changes in `gas/Export.js` and touched `tests/test_export_*` / `tests/c1_*` files.
  2. Re-run `node tests/test_csv_row_regression.js`, `npm run typecheck`, and `npm test`.
  3. If rollback checks fail, stop and restore from pre-C1 checkpoint.
- No-go conditions (must stop and escalate for spec update):
  - Any required behavior can only be preserved by editing forbidden files.
  - V1 or V2 cannot be satisfied without changing ownership boundaries.
  - Existing export contract tests indicate required behavior changes beyond refactor-only scope.

## Implementation notes (optional)
- Keep all extraction helpers in `gas/Export.js`; C1 must not create a new production module.
- Keep entrypoint wrappers in `gas/ExportEntrypoints.js` untouched.
- New C1 tests must use prefix `tests/c1_*` and remain deterministic (no network/time randomness).
