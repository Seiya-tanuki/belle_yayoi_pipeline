# Refactoring Program Plan - Parallel Consult/Implement Execution

Date: 2026-02-06
Repository: `belle_yayoi_pipeline_v0`
Prepared from:
- `temp/refactor_assessment_01_executive.md`
- `temp/refactor_assessment_02_module_responsibility.md`
- `temp/refactor_assessment_03_traceability_and_testability.md`
- `temp/refactor_assessment_04_refactoring_roadmap.md`

## 1. Problem Classification

Primary problem types:
1. Responsibility concentration in core runtime modules (`Export.js`, `Queue.js`, `OcrWorkerParallel.js`).
2. Uneven testability/traceability for operational control-plane modules (`Dashboard*`, maintenance/archive services).
3. High merge-conflict risk during multi-agent execution because many tests load shared core files.

Key constraints:
1. Implementation must be spec-driven from `.spec/specs/*.md`.
2. `tdd-standard` specs require explicit Red/Green evidence.
3. Runtime-behavior changes require observability plans (or explicit waiver when not applicable).
4. Implement lane runs in fresh threads and should stay single-spec scoped.

## 2. Option Set (1 Recommended + 2 Alternatives)

### Option A (Recommended): Wave-based path ownership + lock matrix

Summary:
- Run multiple agents in parallel only for disjoint path scopes.
- Introduce wave gates and a lock matrix so hot files are single-writer.

Pros:
1. Lowest conflict probability with still-meaningful parallel speedup.
2. Compatible with current two-lane process and spec authority model.
3. Easy to audit: each spec has explicit `allow_edit` boundaries.

Cons:
1. Core hot-zone refactors still partly serial.
2. Needs coordination overhead (owner table, wave gate checks).

Key risks / failure modes:
1. Hidden overlap through shared test files.
2. Cross-wave dependency drift if specs are written without shared assumptions.

Complexity: Medium

Operational considerations:
1. Maintain an active lock table before starting each implement thread.
2. Merge only after per-spec judge pass + wave verification.

### Option B: High-concurrency trunk with continuous rebasing

Summary:
- Maximize active implement threads and resolve conflicts by frequent rebases/merges.

Pros:
1. Fastest raw throughput when conflicts are small.
2. Less up-front planning.

Cons:
1. Highest conflict risk in this repository due shared core and test loaders.
2. Harder root-cause analysis when regressions appear mid-wave.

Key risks / failure modes:
1. Rebase churn dominates implementation time.
2. Partial merges introduce subtle parity regressions.

Complexity: Medium

Operational considerations:
1. Requires strict merge queue automation (not currently established).
2. Requires frequent full-suite runs.

### Option C: Serial core-first refactor with minimal parallelism

Summary:
- Refactor core modules one-by-one, allow parallelism only in isolated test additions.

Pros:
1. Lowest technical ambiguity.
2. Very simple conflict management.

Cons:
1. Slowest delivery.
2. Under-utilizes multi-agent capacity.

Key risks / failure modes:
1. Program fatigue and long cycle time.
2. Late discovery of integration issues.

Complexity: Low

Operational considerations:
1. Easy governance, but schedule risk is high.

## 3. Recommended Execution Model (Option A)

### 3.1 Parallelism budget

Consult lane parallelism:
- Up to 3 active consult threads.
1. `C1` Spec drafting batch A
2. `C2` Spec drafting batch B
3. `C3` Spec-check/judge gatekeeper

Implement lane parallelism:
- Cold zone (disjoint operational modules): up to 3 active implement threads.
- Warm zone (core modules with limited overlap): up to 2 active implement threads.
- Hot zone (shared core contracts): 1 active implement thread.

### 3.2 Conflict-prevention rules (mandatory)

1. Single-writer file lock:
- No two active specs may include the same file path in `scope.allow_edit`.

2. Narrow `allow_edit` policy:
- For this program, use explicit file paths for hot modules instead of broad directory-only scopes.

3. Shared-file freeze list (only integration wave owner may edit):
- `gas/DocTypeRegistry.js`
- `gas/Config.js`
- `gas/Code.js`
- `gas/ExportEntrypoints.js`
- `gas/Log.js`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`

4. Test file ownership:
- New tests must use unique file names per track.
- Existing test file edits are allowed only by the track that owns that file for the wave.

5. Gatekeeper enforcement:
- Before any implement thread starts, consult gatekeeper verifies lock-matrix non-overlap.

### 3.3 Waves and concurrency design

#### Wave 0 (Serial setup)

Goal:
- Establish baseline and generate spec backlog with explicit path scopes.

Deliverables:
1. Spec backlog list finalized.
2. Lock matrix approved.
3. Shared-file freeze announced.

#### Wave 1 (Cold zone, max 3 implement threads)

Goal:
- Expand tests for currently unprotected operational modules.

Tracks:
1. Track O1: `MaintenanceMode.js` + `ExportRunService.js`
2. Track O2: `LogArchiveService.js` + `ImageArchiveBatchService.js` (+ `ArchiveNaming.js` if needed)
3. Track O3: `DashboardApi.js` server-side contract tests (exclude `Dashboard.html` for now)

Why parallel is safe:
- Primary GAS files are disjoint.
- Test additions can be file-separated.

#### Wave 2 (Warm zone, max 2 implement threads)

Goal:
- Start core responsibility extraction with bounded overlap.

Tracks:
1. Track C1: `Export.js` internal skeleton extraction (no external entrypoint changes)
2. Track C2: `Queue.js` claim/stale/legacy helper split

Safety note:
- If either track needs shared freeze files, pause and move that edit to integration wave.

#### Wave 3 (Hot zone, max 1 implement thread)

Goal:
- `OcrWorkerParallel.js` state-transition split after queue/export stabilization.

Track:
1. Track C3: OCR worker decomposition + focused branch tests.

#### Wave 4 (Warm zone, max 2 implement threads)

Goal:
- Dashboard decomposition and cross-cutting test helper extraction.

Tracks:
1. Track U1: `Dashboard.html` JS decomposition (client-side boundaries)
2. Track T1: Shared test helper library extraction (only if conflict-free with U1)

#### Wave 5 (Hot integration, max 1 implement thread)

Goal:
- Correlation key normalization across dashboard -> queue -> worker -> export.

Track:
1. Track X1: correlation key propagation and observability verification.

Reason for serial:
- This track intentionally touches multiple previously isolated modules.

## 4. Spec Backlog Blueprint (for Consult lane)

Use one spec per track (minimum). Suggested IDs/slugs (example naming):

1. `T-20260206-OPS-O1-maintenance-exportrun-tests.md`
2. `T-20260206-OPS-O2-archive-services-tests.md`
3. `T-20260206-OPS-O3-dashboard-api-tests.md`
4. `T-20260206-CORE-C1-export-skeleton-extraction.md`
5. `T-20260206-CORE-C2-queue-claim-stale-split.md`
6. `T-20260206-CORE-C3-ocr-worker-state-split.md`
7. `T-20260206-UI-U1-dashboard-script-decomposition.md`
8. `T-20260206-TEST-T1-test-helper-library.md`
9. `T-20260206-INTEG-X1-correlation-key-normalization.md`

Spec authoring rules:
1. Every spec includes AC IDs, traceability matrix, and deterministic verification steps.
2. `playbook` selection:
- O1/O2/O3: `tdd-standard`
- C1/C2/C3/U1: `refactor-boundary` (or `tdd-standard` where behavior changes are expected)
- X1: `migration-safe` (high-risk cross-module runtime change)
3. Runtime behavior changes must include observability plans (signal name, emit location, V-step mapping).

## 5. Branch and Integration Policy

1. Branch naming:
- `feat/<track-slug>-YYYYMMDD`

2. One branch per spec.

3. Merge gate per spec:
1. Judge result is Accept.
2. Spec verification commands pass.
3. Wave-level regression passes:
- `node tests/test_csv_row_regression.js`
- `npm run typecheck`
- `npm test`

4. Merge gate per wave:
1. No active file-lock conflicts.
2. Full suite green once after integrating all specs in that wave.

## 6. Minimal Operating Cadence

1. Consult sync (start of day):
- Finalize active wave specs and lock table.

2. Implement execution:
- Each implement thread: one spec only, fresh thread, produce report, stop.

3. Judge sync (continuous):
- Review each completed spec report immediately to avoid queue buildup.

4. Wave close:
- Run full verification and publish a short wave summary.

## 7. Initial Go Plan (next actions)

1. Start Wave 0 now:
- Draft O1/O2/O3 specs in parallel (3 consult threads).

2. Launch Wave 1 implement threads only after lock check passes.

3. Do not start C1/C2/C3 until O-wave test coverage is merged and stable.

4. Keep X1 (correlation normalization) as final integration-only track.

## 8. Success Criteria for the Program

1. Core modules are decomposed with boundary/parity guarantees preserved.
2. Previously untested operational modules gain deterministic tests.
3. Every implemented spec has AC traceability + Red/Green or boundary evidence.
4. No unresolved merge conflicts caused by overlapping active scopes.
5. End-to-end diagnosability improves through standardized correlation flow.
