相談役を起動

この内容で仕様書作成

Wave 5 / Track X1
Create a handoff-ready integration spec for correlation key normalization across dashboard -> queue -> worker -> export.

Target spec file:
- `.spec/specs/T-20260206-INTEG-X1-correlation-key-normalization.md`

Required meta:
- playbook: `migration-safe`
- risk: `high`

Scope intent for Implement lane (integration-only, single track):
- allow_edit candidate set (spec must finalize minimal exact allowlist):
  - `gas/Dashboard.html`
  - `gas/DashboardApi.js`
  - `gas/Queue.js`
  - `gas/OcrWorkerParallel.js`
  - `gas/Export.js`
  - `gas/Log.js`
  - `gas/Config.js`
  - `gas/Code.js`
  - `gas/ExportEntrypoints.js`
  - `tests/x1_*`
  - selected existing tests only with explicit file-by-file allowlist
- forbid_edit baseline:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`

Mandatory execution policy for this wave:
1. X1 is a hot integration track and must run as max parallel = 1 (serial only).
2. Spec must define explicit `scope.allow_edit` and `scope.forbid_edit` with exact paths/patterns.
3. If implementation requires any non-owned path:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`.
- Do not continue until consult update is provided.

Spec requirements (must satisfy migration-safe preconditions):
1. Include a phased migration plan with reversible strategy:
- Phase A: compatibility path introduction (backward compatible)
- Phase B: propagation/backfill normalization path
- Phase C: read-path switch
- Phase D: cleanup (post-confirmation only)
2. Define rollback plan and abort criteria for each phase.
3. Define observability plan with concrete signals, thresholds, and abort conditions:
- correlation key presence/consistency from dashboard action through queue/worker/export logs
- mismatch counters and hard-stop thresholds
- where each signal is emitted and how to verify it
4. Define deterministic verification with stable IDs:
- boundary proofs covering tracked/staged/unstaged/untracked changes
- compatibility/parity checks for old vs normalized key behavior
- end-to-end propagation proofs for dashboard -> queue -> worker -> export
- repo baseline checks (`csv/typecheck/npm test`)
5. Preserve existing contracts unless explicitly listed and migration-safe justified.
6. Include no-go conditions and operator-safe rollout notes.

Acceptance focus:
1. Correlation key semantics are normalized end-to-end without breaking existing contracts.
2. Migration remains reversible until explicit final cleanup.
3. Evidence is sufficient to run this high-risk integration safely.

After drafting, run spec-check and revise until implement-handoff ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
