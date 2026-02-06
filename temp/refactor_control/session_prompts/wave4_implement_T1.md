実装役を起動

Spec path:
- `.spec/specs/T-20260206-TEST-T1-test-helper-library.md`

Wave:
- Wave 4 / Track T1

Execution goal:
- Implement the spec exactly as written (`playbook: refactor-boundary`).
- Extract shared deterministic test helpers and migrate only allowlisted tests.

Mandatory precondition:
1. Run this track in a dedicated T1 branch/worktree only.
2. Do not run T1 implementation in a shared dirty branch.
3. Run V1 and V2 boundary proofs before starting edits, and again before finalizing.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive ownership for T1:
- `tests/helpers/*`
- `tests/t1_*`
- allowlisted migrated tests only:
  - `tests/test_ocr_claim_headers.js`
  - `tests/test_ocr_claim_cursor.js`
  - `tests/test_ocr_reap_stale.js`
  - `tests/test_sheet_append_rows.js`
  - `tests/test_queue_pdf_guard.js`
  - `tests/test_queue_skip_log_routing.js`
  - `tests/test_queue_skip_log_dedupe.js`

2. Mandatory non-overlap with U1:
- No edits to `gas/Dashboard.html`
- No edits to `tests/u1_*`
- No edits to `tests/test_dashboard_*`

3. Forbidden file edits for T1:
- all `gas/*`
- `.spec/specs/*`
- `.agents/*`
- `.lanes/*`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`

4. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT` with exact file path and reason.
- Do not continue until consult update is provided.

Implementation method:
1. Follow spec AC/V steps exactly.
2. Keep this track test-only (no runtime production file edits).
3. Migrate only explicitly allowlisted tests.
4. Capture required evidence and create implementation report in `.spec/reports/`.

Required verification (from spec):
- V1 ownership boundary proof (tracked/staged/unstaged/untracked coverage).
- V2 forbidden/U1 non-overlap boundary proof (tracked/staged/unstaged/untracked coverage).
- V3 helper smoke tests:
  - `tests/t1_helper_module_loader_smoke.js`
  - `tests/t1_helper_mock_sheet_range_smoke.js`
  - `tests/t1_helper_assertions_smoke.js`
- V4 migrated parity checks on allowlisted tests.
- V5 repo regression checks (`csv/typecheck/npm test`).
- V6 conflict-protocol evidence in implementation report.

Supplemental risks (non-blocking, must be monitored during implementation):
1. Hidden coupling in legacy test harness assumptions.
2. Flaky behavior from shared mutable helper state.
3. Module load-order drift due helper centralization.

Final boundary check (must pass):
- `git diff --name-only -- tests .spec/reports`
- Allowed only:
  - `tests/helpers/*`
  - `tests/t1_*`
  - `tests/test_ocr_claim_headers.js`
  - `tests/test_ocr_claim_cursor.js`
  - `tests/test_ocr_reap_stale.js`
  - `tests/test_sheet_append_rows.js`
  - `tests/test_queue_pdf_guard.js`
  - `tests/test_queue_skip_log_routing.js`
  - `tests/test_queue_skip_log_dedupe.js`
  - T1 report file under `.spec/reports/`

Do not push.
Do not run `clasp deploy`.
