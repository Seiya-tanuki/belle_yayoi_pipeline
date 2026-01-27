# Dashboard Web App (Single-User)

This dashboard is a single-user Web App for Phase 1 operations. It assumes the
deployment is "Only myself" and "Execute as me". There is no user auth or RBAC.

## Files added
- `gas/DashboardWebApp.js` (Web App entry via `doGet`)
- `gas/DashboardApi.js` (server API for overview, logs, ops)
- `gas/Dashboard.html` (UI)

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
- Ops: Queue, OCR enable/disable, Export (with confirmations).
- Logs: Export Guard, Export Skip, Queue Skip (summary only, no PII).

## Notes
- This Web App is single-user only. Do not switch to public access.
- All data aggregation runs server-side; the client uses `google.script.run`.
