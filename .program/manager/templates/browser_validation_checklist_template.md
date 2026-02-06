# Browser Validation Checklist (Template)

## Environment
- branch/worktree:
- target scriptId (dev):
- validation date:

## Pre-check
1. `clasp status` confirms dev target.
2. `clasp push` completed successfully.
3. No `clasp deploy` executed.

## Core scenarios
1. Dashboard load and initial health state.
2. Overview refresh.
3. Logs refresh.
4. Mode change (OCR <-> EXPORT).
5. Queue/OCR action flow.
6. Export-side operation flow.

## Correlation/observability checks
1. `X1_CORR_DASH_ACTION`
2. `X1_CORR_QUEUE_ITEM` / counters
3. `X1_CORR_WORKER_ITEM` / counters
4. `X1_CORR_EXPORT_ITEM` / counters

## Pass criteria
1. No blocking UI/runtime errors.
2. Key operational flows complete.
3. Observability counters remain within expected thresholds.

## Incident notes
| Time | Scenario | Symptom | Severity | Repro steps |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

