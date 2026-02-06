# Refactoring Roadmap (Decision and Implementation Planning)

Date: 2026-02-06

## 1. Goal
Provide a practical, low-risk sequence to improve:

1. module split by responsibility
2. failure diagnosability for users and agents

under the updated three-drive rules.

## 2. Refactor Strategy
Use extraction-first and parity-test-first strategy:

1. no behavior changes in first extraction steps
2. add missing tests around operational modules before deep restructuring
3. maintain existing entrypoint contracts

## 3. Work Packages

## WP-1: Test Coverage Expansion for Operational Paths
Priority: P0  
Scope:
- `gas/MaintenanceMode.js`
- `gas/ExportRunService.js`
- `gas/LogArchiveService.js`
- `gas/ImageArchiveBatchService.js`
- `gas/DashboardApi.js` server logic

Deliverables:
1. New tests proving success and failure paths for each module.
2. Explicit assertions for returned `reason`/`message` and key `data` fields.

Acceptance:
1. Tests fail before implementation change when intentionally broken.
2. Tests pass with current behavior.
3. No regressions in existing full suite.

Risk reduction:
- Prevents silent regressions in control-plane operations.

## WP-2: Export Pipeline Skeleton Extraction
Priority: P0  
Scope:
- Refactor internals of `gas/Export.js` without changing external entrypoints.

Target extracted components (can be helper functions first):
1. common guard evaluator
2. common queue-row iterator with shared skip/error handling
3. common writer for CSV + export log + skip log
4. doc-type converter adapters

Acceptance:
1. Existing export tests remain green:
   - doc-type orchestration
   - dedupe
   - guard log behavior
   - schema guard behavior
2. No change in `phase/reason` outputs for existing tested scenarios.
3. Function sizes reduced materially (target: each doc-type flow under 200 lines).

## WP-3: OCR Worker State Transition Split
Priority: P1  
Scope:
- Internal split of `belle_ocr_workerOnce_` in `gas/OcrWorkerParallel.js`.

Target internal layers:
1. claim verification and attempt init
2. pipeline runner adapter
3. error classification/backoff
4. writeback commit
5. telemetry projection

Acceptance:
1. Existing worker tests remain green:
   - dispatch parity
   - no-target behavior
   - orchestrator boundaries
2. Introduce focused tests for claim-lost and writeback branches.
3. No schema change in perf log row layout.

## WP-4: Queue Module Responsibility Reduction
Priority: P1  
Scope:
- Split queue ingestion, claim logic, stale recovery, and legacy normalization helpers.

Acceptance:
1. Existing queue tests stay green.
2. Add targeted tests around stale recovery transitions and legacy-normalization branch.
3. No change in queue header contract.

## WP-5: Dashboard Script Decomposition
Priority: P2  
Scope:
- Refactor `gas/Dashboard.html` JS into clear sections/helpers while preserving UI output.

Acceptance:
1. No API signature changes for `google.script.run` calls.
2. Smoke validation of boot/setup mode transitions.
3. Add server-side tests for matching `DashboardApi.js` response shapes.

## 4. Cross-Cutting Improvements (Data-Driven)

### 4.1 Correlation ID normalization
Introduce a shared operation correlation key across:
1. dashboard operation
2. queue claim/process logs
3. worker item summary
4. export guard/done/error rows

Expected gain:
- Faster root-cause tracking across sheets/logs.

### 4.2 Shared test helper library
Add reusable test utilities for:
1. mock spreadsheet/range
2. mock drive objects
3. gas source loading

Expected gain:
- Faster test authoring and lower maintenance cost.

## 5. Suggested Sequencing
1. WP-1
2. WP-2
3. WP-3
4. WP-4
5. WP-5

Rationale:
- Strengthen safety net first.
- Then refactor highest-duplication and highest-risk execution paths.

## 6. Go/No-Go Gates per Wave

Go criteria:
1. Existing full test suite passes (`npm test`).
2. New tests for touched module pass.
3. No change in existing output contracts unless explicitly specified.

No-Go criteria:
1. Any unplanned behavior change in `reason/phase` semantics.
2. Loss of observability fields (`error_code`, `error_detail`, guard logs).
3. Drift from entrypoint boundaries validated by boundary tests.

## 7. Estimated Impact
Expected benefits:
1. Lower defect probability for multi-doc-type changes.
2. Faster issue diagnosis by users/agents.
3. Better alignment with three-drive execution gates.

Expected costs:
1. Temporary increase in test maintenance while helper extraction settles.
2. Refactor overhead before feature velocity improves.

Net judgement:
- Positive ROI; proceed.

