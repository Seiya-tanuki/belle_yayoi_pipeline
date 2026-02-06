実装役を起動

Spec path:
- `.spec/specs/T-20260206-CORE-C1-export-skeleton-extraction.md`

Wave:
- Wave 2 / Track C1

Execution goal:
- Implement the spec exactly as written (`playbook: refactor-boundary`).
- Perform extraction-first refactor in `gas/Export.js` with behavior parity.

Mandatory precondition:
1. Run this track in a dedicated branch/worktree (C1 only).
2. Do not run C1 implementation in a shared dirty branch.

Mandatory conflict-prevention overlay (higher priority for this wave):
1. Exclusive production-file ownership (C1):
- `gas/Export.js`

2. Exclusive test-file ownership (C1):
- `tests/test_export_*`
- `tests/c1_*`

3. Forbidden file edits for C1:
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

4. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT` with exact file path and reason.
- Do not continue until consult update is provided.

Implementation method:
1. Follow spec AC/V steps exactly.
2. Execute boundary proofs before finalizing.
3. Preserve existing contracts and entrypoint behavior.
4. Capture required evidence and create implementation report in `.spec/reports/`.

Required verification (from spec):
- V1 ownership/forbidden boundary proof script.
- V2 helper/signature namespace proof.
- V3 export-focused parity checks.
- V4 observability continuity proof (`EXPORT_GUARD`, `EXPORT_DONE`, `EXPORT_ERROR`).
- V5 repo regression checks (`csv/typecheck/npm test`).

Final boundary check (must pass):
- `git diff --name-only -- gas tests .spec/reports`
- Allowed only:
  - `gas/Export.js`
  - `tests/test_export_*`
  - `tests/c1_*`
  - C1 report file under `.spec/reports/`

Do not push.
Do not run `clasp deploy`.
