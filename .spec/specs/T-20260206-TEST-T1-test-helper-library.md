# T-20260206-TEST-T1: Shared test helper extraction with conflict-safe scope

## Meta
- id: T-20260206-TEST-T1
- owner_lane: consult -> implement
- risk: medium
- playbook: refactor-boundary
- scope:
  - allow_edit:
    - tests/helpers/*
    - tests/t1_*
    - tests/test_ocr_claim_headers.js
    - tests/test_ocr_claim_cursor.js
    - tests/test_ocr_reap_stale.js
    - tests/test_sheet_append_rows.js
    - tests/test_queue_pdf_guard.js
    - tests/test_queue_skip_log_routing.js
    - tests/test_queue_skip_log_dedupe.js
  - forbid_edit:
    - .spec/specs/*
    - .agents/*
    - .lanes/*
    - gas/*.js
    - gas/*.html
    - gas/Dashboard.html
    - tests/u1_*
    - tests/test_dashboard_*
    - tests/test_reset_headers.js
    - tests/test_doc_type_registry_callsite_smoke.js
- web_search: disabled
- decision_refs:
  - none

## Goal
Extract deterministic shared test helper primitives for harness setup in `tests/helpers/` (mock sheet/range helpers, module-load helpers, assertion helpers), and migrate only the explicitly allowlisted tests to these helpers while preserving current runtime production behavior and test intent.

## Non-goals
- No production/runtime behavior change.
- No edits to any `gas/*.js` or `gas/*.html` file.
- No edits to dashboard/UI test tracks (`tests/u1_*`, `tests/test_dashboard_*`).
- No migration of non-allowlisted existing tests in this track.
- No deploy actions (`clasp deploy` prohibited; no `clasp push` in this task).

## Context / Constraints
- Primary runtime is Google Apps Script under `gas/`; this track is test-only and limited to Node test harness code under `tests/`.
- Exclusive ownership for T1:
  - `tests/helpers/*`
  - `tests/t1_*`
  - explicitly allowlisted migrated tests only:
    - `tests/test_ocr_claim_headers.js`
    - `tests/test_ocr_claim_cursor.js`
    - `tests/test_ocr_reap_stale.js`
    - `tests/test_sheet_append_rows.js`
    - `tests/test_queue_pdf_guard.js`
    - `tests/test_queue_skip_log_routing.js`
    - `tests/test_queue_skip_log_dedupe.js`
- Mandatory non-overlap with U1:
  - no edits to `gas/Dashboard.html`
  - no edits to `tests/u1_*`
  - no edits to `tests/test_dashboard_*`
- If implementation requires touching any non-owned file:
  - Stop immediately.
  - Report exactly: `BLOCKER: SCOPE_CONFLICT <file-path> <reason>`
  - Do not continue until consult updates scope.
- Runtime behavior changes: no (test-only refactor track).
- Helper design constraints:
  - deterministic behavior only (no time/random/network dependence unless explicitly injected);
  - no shared mutable singleton state leaking across test files;
  - module-load helper must preserve explicit GAS file load-order chosen by each test.

## Proposed approach
1. Introduce helper modules under `tests/helpers/`:
   - module loading helper(s) for deterministic VM sandbox creation and ordered GAS script loading;
   - mock spreadsheet helper(s) for `MockRange`, `MockSheet`, and `MockSpreadsheet`;
   - assertion helper(s) to replace duplicated inline `expect` patterns.
2. Add focused smoke tests under `tests/t1_*` to verify each helper primitive independently.
3. Migrate only the allowlisted existing tests to helper usage without changing test assertions or behavior contracts.
4. Run boundary proofs, helper smoke tests, migrated parity checks, then repository baseline regressions.

## Acceptance Criteria (testable, with stable IDs)
1. [AC-1] A shared helper library exists under `tests/helpers/` with deterministic primitives for:
   - VM/module loading in explicit load order;
   - mock sheet/range/spreadsheet interactions used by queue/sheet tests;
   - assertion helpers used by migrated tests.
2. [AC-2] Helper smoke tests under `tests/t1_*` deterministically validate helper behavior and pass without relying on production code edits.
3. [AC-3] Only explicitly allowlisted existing tests are migrated, and migrated tests preserve existing behavior contracts and pass results.
4. [AC-4] Ownership boundaries and forbidden-file constraints are preserved, including mandatory U1 non-overlap.
5. [AC-5] Repository baseline regression commands remain green after migration.
6. [AC-6] Non-owned file requirements are handled with hard-stop conflict protocol (`BLOCKER: SCOPE_CONFLICT`) and no out-of-scope continuation.

## Traceability Matrix (required)
| AC ID | Verification step ID(s) | Expected evidence |
| --- | --- | --- |
| AC-1 | V3, V4 | New helper files and helper smoke outputs prove deterministic module-load/mock/assertion primitives are usable by migrated tests. |
| AC-2 | V3 | `tests/t1_*` smoke tests pass with explicit OK lines and exit code `0`. |
| AC-3 | V1, V4 | Diff scope proves only allowlisted migrations; migrated tests pass with unchanged intent/parity assertions. |
| AC-4 | V1, V2 | Boundary/forbidden proofs show no out-of-scope edits and no U1-overlap file changes. |
| AC-5 | V5 | Regression command sequence exits `0` for repo baseline checks. |
| AC-6 | V6 | Execution report contains either explicit no-conflict statement or `BLOCKER: SCOPE_CONFLICT` stop evidence with exact path/reason. |

## Verification
1. [V1] Ownership boundary proof (must pass):
   ```powershell
   $tracked = @(git diff --name-only HEAD)
   $untracked = @(git ls-files --others --exclude-standard)
   $changed = @($tracked + $untracked | Sort-Object -Unique)
   $ok = $true

   $allow = @(
     '^tests/helpers/.*$',
     '^tests/t1_.*$',
     '^tests/test_ocr_claim_headers\.js$',
     '^tests/test_ocr_claim_cursor\.js$',
     '^tests/test_ocr_reap_stale\.js$',
     '^tests/test_sheet_append_rows\.js$',
     '^tests/test_queue_pdf_guard\.js$',
     '^tests/test_queue_skip_log_routing\.js$',
     '^tests/test_queue_skip_log_dedupe\.js$',
     '^\.spec/reports/.*$'
   )

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
   - Pass criteria: exit `0`; no `OUT_OF_SCOPE`; tracked/staged/unstaged/untracked changes are all covered.
2. [V2] Forbidden/U1-non-overlap proof (must pass):
   ```powershell
   $tracked = @(git diff --name-only HEAD)
   $untracked = @(git ls-files --others --exclude-standard)
   $changed = @($tracked + $untracked | Sort-Object -Unique)
   $ok = $true

   $forbidden = @(
     '^\.spec/specs/.*$',
     '^\.agents/.*$',
     '^\.lanes/.*$',
     '^gas/.*$',
     '^tests/u1_.*$',
     '^tests/test_dashboard_.*$',
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
   - Pass criteria: exit `0`; no `FORBIDDEN_EDIT`; tracked/staged/unstaged/untracked changes are all covered.
3. [V3] Helper smoke tests (must pass):
   - `node tests/t1_helper_module_loader_smoke.js`
   - `node tests/t1_helper_mock_sheet_range_smoke.js`
   - `node tests/t1_helper_assertions_smoke.js`
   - Pass criteria: all commands exit `0` and print terminal `OK:` lines.
4. [V4] Migrated-test parity checks (must pass):
   - `node tests/test_ocr_claim_headers.js`
   - `node tests/test_ocr_claim_cursor.js`
   - `node tests/test_ocr_reap_stale.js`
   - `node tests/test_sheet_append_rows.js`
   - `node tests/test_queue_pdf_guard.js`
   - `node tests/test_queue_skip_log_routing.js`
   - `node tests/test_queue_skip_log_dedupe.js`
   - Pass criteria: all commands exit `0`; assertions remain parity-preserving for existing test intent.
5. [V5] Repository baseline regressions (must pass):
   - `node tests/test_csv_row_regression.js`
   - `npm run typecheck`
   - `npm test`
   - Pass criteria: all commands exit `0`.
6. [V6] Conflict protocol evidence (must pass):
   - Verify implement report includes one of:
     - explicit statement that no non-owned files were required, or
     - `BLOCKER: SCOPE_CONFLICT <file-path> <reason>` and immediate stop behavior.
   - Pass criteria: if blocker appears, no out-of-scope edits exist; if no blocker, V1/V2 remain green.

## Observability Plan
- Runtime observability impact:
  - none (no runtime code changes; test-only refactor).
- Waiver:
  - `test-only, no runtime behavior change`
- Verification mapping:
  - V1/V2/V5 guarantee runtime files stay untouched while test suite remains green.

## Safety / Rollback
- Potential failure modes:
  - hidden coupling in legacy test harness assumptions causes migrated tests to fail unexpectedly;
  - shared mutable helper state introduces flaky cross-test behavior;
  - helper centralization changes module load-order semantics and breaks deterministic VM setup;
  - accidental out-of-scope edit during migration.
- No-go conditions (stop and revise):
  - any V1 or V2 boundary proof failure;
  - any migration outside explicit allowlist;
  - any helper smoke failure (V3), migrated parity failure (V4), or baseline regression failure (V5);
  - any need for non-owned-file edit without consult-approved scope update.
- Rollback steps:
  1. Revert only T1-owned touched files (`tests/helpers/*`, `tests/t1_*`, and explicitly allowlisted migrated tests).
  2. Re-run V3 and V4 to confirm helper/migration state is restored.
  3. Re-run V5 to confirm repository baseline is restored.
  4. Re-apply migration in smaller slices (helper creation first, then one migrated test at a time).

## Implementation notes (optional)
- Keep helper modules stateless by default; if cache is unavoidable, provide explicit reset hooks and use them per test.
- Prefer helper APIs that keep assertions local/readable in each test file (do not hide scenario intent).
- Suggested helper file split:
  - `tests/helpers/module_loader.js`
  - `tests/helpers/mock_sheet.js`
  - `tests/helpers/assertions.js`
