# Dashboard Web App (Single-User)

This dashboard is a single-user Web App for Phase 1 operations. It assumes the
deployment is "Only myself" and "Execute as me". There is no user auth or RBAC.

## Files added
- `gas/DashboardWebApp.js` (Web App entry via `doGet`)
- `gas/DashboardApi.js` (server API for overview, logs, ops)
- `gas/Dashboard.html` (UI)
- `gas/MaintenanceMode.js` (maintenance state + quiesce)
- `gas/DashboardMaintenanceApi.js` (maintenance endpoints)
- `gas/LogArchiveService.js` (archive/clear logs)
- `gas/ExportRunService.js` (export run orchestration)
- `gas/ImageArchiveService.js` (archive images)

## Deploy (Apps Script)
1. Open the Apps Script project.
2. Confirm the new dashboard files exist in the project.
3. Click `Deploy` -> `New deployment`.
4. Select type: `Web app`.
5. Set `Execute as` to `Me`.
6. Set `Who has access` to `Only myself`.
7. Click `Deploy` and copy the Web App URL.

## Usage
- Overview: shows status counts per active doc type.
- Ops (OCR mode): Queue, OCR enable/disable.
- Ops (Maintenance mode): Quiesce & enter, Export Run, Archive + Clear Logs, Exit.
- Logs: Export Guard, Export Skip, Queue Skip (summary only, no PII).

## Script properties
- Required (health check gate):
  - `BELLE_SHEET_ID`: Main spreadsheet ID (queue + logs + export).
  - `BELLE_INTEGRATIONS_SHEET_ID`: Integrations spreadsheet ID (perf + audit logs).
  - `BELLE_DRIVE_FOLDER_ID`: Input root folder (receipt/cc/bank subfolders).
  - `BELLE_LOG_ARCHIVE_FOLDER_ID`: Root folder for report + log archives.
  - `BELLE_IMAGES_ARCHIVE_FOLDER_ID`: Root folder for archived OCR images.
  - `BELLE_GEMINI_API_KEY`: Gemini API key (non-empty).
  - `BELLE_GEMINI_MODEL`: Gemini model name (non-empty).
  - `BELLE_OUTPUT_FOLDER_ID`: Export output root folder.
  - `BELLE_FISCAL_START_DATE`: YYYY-MM-DD (start).
  - `BELLE_FISCAL_END_DATE`: YYYY-MM-DD (end, >= start).
  - `BELLE_OCR_MAX_ATTEMPTS`: Integer 1..10.
  - `BELLE_OCR_RETRY_BACKOFF_SECONDS`: Integer 0..86400.
  - `BELLE_EXPORT_BATCH_MAX_ROWS`: Integer 1..50000.
- Optional:
  - `BELLE_MAINTENANCE_TTL_MINUTES`: Default 30. Auto-expires maintenance mode.

## Environment health check (setup view)
- On page load, the dashboard runs a health check and provisions missing sheets/folders where safe.
- If NOT READY, a setup view is shown with diagnostics and a Re-check button.
- Ensured resources:
  - Queue and log sheets in `BELLE_SHEET_ID` (OCR_* + EXPORT_* + SKIP + GUARD).
  - Input subfolders for active doc types under `BELLE_DRIVE_FOLDER_ID`.
  - Archive subfolders under `BELLE_IMAGES_ARCHIVE_FOLDER_ID` and `export_run_reports/YYYY/MM` under `BELLE_LOG_ARCHIVE_FOLDER_ID`.

## Maintenance mode
- Maintenance mode is mutually exclusive with OCR operations.
- Entering maintenance requires OCR triggers already disabled, no live processing, and a script lock.
- Maintenance auto-expires back to OCR mode after the TTL.

## Runbooks
1) Enter maintenance:
   - Click `Quiesce & Enter`.
   - Confirm mode badge shows MAINTENANCE with expiry.
2) Export Run:
   - Click `Export Run`.
   - On success, report spreadsheet is created under `export_run_reports/YYYY/MM/`.
3) Archive + Clear Logs:
   - Click `Archive + Clear Logs`.
   - PERF_LOG and DASHBOARD_AUDIT_LOG are archived and cleared in the integrations sheet.
4) Exit maintenance:
   - Click `Exit Maintenance` to return to OCR mode.

## Notes
- This Web App is single-user only. Do not switch to public access.
- All data aggregation runs server-side; the client uses `google.script.run`.
