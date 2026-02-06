# Refactoring Assessment (Post-Rule-Update) - Executive Summary

Date: 2026-02-06  
Repository: `belle_yayoi_pipeline_v0`

## 1. Purpose
This report evaluates whether the current implementation should be refactored under the updated three-drive rules:

- Spec-driven development
- Test-driven development
- Data-driven development

Focus points requested:

1. Whether module split by function/responsibility is appropriate.
2. Whether tests and traceability are sufficient for users/agents to identify root causes on failure.

## 2. Evaluation Baseline (Rules)
The updated rule system requires:

- Spec gate with traceability (`AGENTS.md:18` to `AGENTS.md:28`)
- TDD evidence (Red/Green) for `tdd-standard` (`AGENTS.md:22` to `AGENTS.md:24`, `.agents/playbooks/tdd-standard.md:7` to `.agents/playbooks/tdd-standard.md:16`)
- Observability plan/waiver (`AGENTS.md:25` to `AGENTS.md:27`)
- Implement lane enforcement for traceability + observability (`.lanes/implement/AGENTS.md:17` to `.lanes/implement/AGENTS.md:30`)

## 3. Current State Snapshot
- GAS files: 38 (`gas/*.js`) + `Dashboard.html`
- Test files: 90 (`tests/*.js`)
- Largest implementation files:
  - `gas/Export.js`: 1300 lines
  - `gas/Dashboard.html`: 1054 lines
  - `gas/Queue.js`: 686 lines
  - `gas/YayoiExport.js`: 656 lines
  - `gas/OcrWorkerParallel.js`: 517 lines
  - `gas/EnvHealthCheck.js`: 421 lines
  - `gas/DashboardApi.js`: 427 lines

## 4. High-Level Judgement
### 4.1 Module/Responsibility Split
Judgement: **Refactor needed (high priority)**.

Why:
- Core orchestration files are responsibility-heavy:
  - `gas/Export.js` contains three large doc-type export pipelines with repeated guard/scan/log flow (`gas/Export.js:150`, `gas/Export.js:566`, `gas/Export.js:930`).
  - `gas/Queue.js` mixes queue ingestion, claim/lock/stale-recovery, and legacy OCR processing (`gas/Queue.js:72`, `gas/Queue.js:236`, `gas/Queue.js:451`).
  - `gas/OcrWorkerParallel.js` has a very large `workerOnce` orchestration path (`gas/OcrWorkerParallel.js:41`).
  - `gas/Dashboard.html` has 27 inline functions and 12 UI event bindings in one file.

### 4.2 Failure Diagnosability (Tests + Traceability)
Judgement: **Partially strong, but coverage is uneven; refactor + test expansion needed**.

Strengths:
- Queue schema preserves error code/detail fields (`gas/Queue.js:16` to `gas/Queue.js:21`).
- Logging utilities support header guard/rotation and dedupe (`gas/Log.js:8` to `gas/Log.js:27`, `gas/Log.js:59` to `gas/Log.js:163`).
- Important observability tests exist:
  - invalid-schema detail truncation: `tests/test_ocr_invalid_schema_log_detail.js`
  - perf-log schema: `tests/test_perf_log_v2.js`
  - perf/webhook log rotation: `tests/test_perf_log_rotation.js`, `tests/test_webhook_log_rotation.js`
  - export guard and skip routing/dedupe: `tests/test_export_log_schema_guard.js`, `tests/test_queue_skip_log_dedupe.js`, `tests/test_queue_skip_log_routing.js`

Weaknesses:
- Several operational modules have zero direct test references:
  - `gas/DashboardApi.js`
  - `gas/DashboardWebApp.js`
  - `gas/DashboardAuditLog.js`
  - `gas/DashboardMaintenanceApi.js`
  - `gas/MaintenanceMode.js`
  - `gas/ExportRunService.js`
  - `gas/ImageArchiveBatchService.js`
  - `gas/LogArchiveService.js`
- Dashboard UI (`gas/Dashboard.html`) is untested by local Node harness.

## 5. Final Decision
**Refactoring should be executed.**

Reason:
- Current system already has good foundations (registry-driven doc-type model, boundary/load-order tests, structured logs), but the concentration of responsibility in core files and the untested operational paths create meaningful long-term risk.
- With the new three-drive rules, these risks are now explicitly mismatched with desired implementation behavior, especially for repeatable agent execution and root-cause analysis.

## 6. Report Index
- Detailed module split findings: `temp/refactor_assessment_02_module_responsibility.md`
- Detailed traceability/testing findings: `temp/refactor_assessment_03_traceability_and_testability.md`
- Prioritized implementation roadmap: `temp/refactor_assessment_04_refactoring_roadmap.md`

