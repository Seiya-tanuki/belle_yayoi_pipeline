# Refactoring Assessment - Module/Responsibility Split

Date: 2026-02-06

## 1. Scope
This document evaluates the current module split against "function and responsibility boundaries."

## 2. Positive Existing Structure
The project already has meaningful boundary controls:

1. Doc-type behavior is centralized in registry specs.
   - `gas/DocTypeRegistry.js:12` to `gas/DocTypeRegistry.js:27`
   - `gas/DocTypeRegistry.js:40` to `gas/DocTypeRegistry.js:116`
2. Entrypoint wrappers are separated from internal helpers.
   - `gas/Code.js:5` to `gas/Code.js:15`
   - `gas/ExportEntrypoints.js:5` to `gas/ExportEntrypoints.js:23`
3. Boundary tests exist and pass.
   - `tests/test_code_entrypoints_boundary.js`
   - `tests/test_export_module_boundaries.js`
   - `tests/test_queue_module_boundaries.js`
   - `tests/test_ocr_worker_orchestrator_boundaries.js`

These are strong foundations and should be preserved during refactor.

## 3. Responsibility Concentration Findings

### 3.1 `gas/Export.js` (1300 lines)
Main issue: Three doc-type export functions each contain near-identical workflow skeletons with doc-type-specific inner conversion.

Key evidence:
- Receipt pipeline start: `gas/Export.js:150`
- Bank pipeline start: `gas/Export.js:566`
- CC pipeline start: `gas/Export.js:930`
- Shared guard/result signals repeated many times:
  - `EXPORT_GUARD`: many repeated blocks (example lines: `gas/Export.js:190`, `gas/Export.js:602`, `gas/Export.js:966`)
  - `OCR_PENDING` and `OCR_RETRYABLE_REMAINING` checks repeated in each pipeline
  - `OCR_JSON_MISSING`/`OCR_JSON_PARSE_ERROR` branches repeated for all pipelines

Approximate function size:
- `belle_exportYayoiCsvReceiptInternal_`: 416 lines
- `belle_exportYayoiCsvBankStatementInternal_`: 364 lines
- `belle_exportYayoiCsvCcStatementInternal_`: 367 lines

Risk:
- A bug fix in one pipeline can be omitted in others.
- High cognitive load for agent modifications.
- Increased chance of accidental divergence in guard behavior.

### 3.2 `gas/Queue.js` (686 lines)
Main issue: Queue ingestion, claim-lock orchestration, stale lock recovery, legacy normalization, and OCR run-once execution all coexist.

Key evidence:
- Queue write path: `gas/Queue.js:72` (`belle_queueFolderFilesToSheetInternal_`)
- Claim and stale recovery path: `gas/Queue.js:236` (`belle_ocr_claimNextRow_`)
- OCR processing path: `gas/Queue.js:451` (`belle_processQueueOnceForDocType_`, ~236 lines)

Risk:
- Hard to reason about lock state transitions vs OCR result transitions.
- High coupling between queue schema details and runtime execution behavior.

### 3.3 `gas/OcrWorkerParallel.js` (517 lines)
Main issue: One orchestrator function handles claim validation, attempt bookkeeping, pipeline dispatch, error classification, writeback, and summary payload shaping.

Key evidence:
- Large worker function: `gas/OcrWorkerParallel.js:41` to `gas/OcrWorkerParallel.js:410` (~370 lines)
- Summary loop + metric aggregation: `gas/OcrWorkerParallel.js:412` to `gas/OcrWorkerParallel.js:517`

Risk:
- Hard to isolate bugs in claim-loss, retry, and writeback logic.
- Difficult to unit-test state transitions without broad mocks.

### 3.4 Dashboard surface split
Main issue: UI script and operational APIs are substantial but not decomposed/tested in parallel.

Evidence:
- `gas/Dashboard.html`: 1054 lines, 27 functions, 12 event bindings.
- `gas/DashboardApi.js`: 427 lines, includes overview/log reads and many operation handlers (`gas/DashboardApi.js:122`, `gas/DashboardApi.js:289`, `gas/DashboardApi.js:317` to `gas/DashboardApi.js:466`)

Risk:
- UI behavior and API contract changes are hard to verify in local test harness.

## 4. Recommended Target Split (Pragmatic)

### 4.1 Export split
Keep entrypoints unchanged. Internally split into:

1. Guard evaluator (fiscal/header/pending/retryable/export-log schema)
2. Row scanner (queue row iteration + common skip/error categories)
3. Doc-type transformers (`receipt`, `cc_statement`, `bank_statement`)
4. Result writer (CSV write + export log flush + skip log flush)

Expected outcome:
- Single source of truth for guard semantics.
- Lower duplication and safer multi-doc-type changes.

### 4.2 Queue split
Split `Queue.js` into internal modules (or files if desired):

1. Queue ingestion service
2. Claim/lock service
3. Stale recovery + legacy normalization helper
4. Single-run OCR executor (legacy path)

Expected outcome:
- Clearer lock ownership invariants.
- Easier staged replacement with `OcrWorkerParallel` behavior.

### 4.3 OCR worker split
Split `belle_ocr_workerOnce_` into:

1. Claim validation + attempt setup
2. Pipeline execution adapter
3. Error classification/backoff policy
4. Queue row writeback
5. Telemetry projection

Expected outcome:
- Better test granularity for each state transition.
- Faster defect isolation in production incidents.

### 4.4 Dashboard split
Preserve HTML output but split script responsibilities:

1. API client wrapper (`google.script.run` calls)
2. Rendering utilities
3. Operation command handlers
4. Boot and mode state coordinator

Expected outcome:
- Smaller change surface per feature.
- Feasible headless tests for API contract and rendering transforms.

## 5. Priority (Responsibility-only view)
1. `Export.js` extraction (highest immediate value, lowest behavioral risk if done by pure extraction + parity tests)
2. `OcrWorkerParallel.js` extraction
3. `Queue.js` claim/legacy split
4. Dashboard JS split

## 6. Refactor "Do Not Break" Contracts
During extraction, preserve:

1. Existing entrypoint names (`gas/Code.js`, `gas/ExportEntrypoints.js`)
2. Existing log schema names and headers (`gas/Log.js`)
3. Doc-type registry contract (`gas/DocTypeRegistry.js`)
4. Existing boundary/load-order tests

