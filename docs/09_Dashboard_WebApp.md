# Dashboard Web App (Phase 1)

## Overview
The Phase 1 dashboard provides a thin HtmlService UI to run normal operations without opening Sheets or the Apps Script editor. It reads overview/log summaries from backend APIs and triggers existing queue/OCR/export entrypoints.

## Deployment (Web App)
1. Open the Apps Script project.
2. Deploy > New deployment.
3. Select type: Web app.
4. Set Execute as: Me (owner).
5. Set Who has access: Only myself (recommended) or domain users as appropriate.
6. Deploy and copy the Web app URL.

## Access Control (RBAC)
Set Script Properties in the Apps Script project:
- `BELLE_DASHBOARD_ADMIN_EMAILS` : comma-separated admin emails.
- `BELLE_DASHBOARD_USER_EMAILS`  : comma-separated user emails.

Users not in these allowlists receive `role = none` and are denied.

## Audit Log
The dashboard appends an audit row per API call to the sheet:
- Sheet name: `DASHBOARD_AUDIT_LOG`
- Header: `ts_iso, rid, actor_email, role, action, request_redacted, ok, reason, message`

## UI Sections
- Header: shows the signed-in actor email and role.
- Overview: doc type x status counts (QUEUED / PROCESSING / DONE / ERROR / ERROR_RETRYABLE / UNKNOWN).
- Operations: Queue, OCR parallel enable/disable, Export (admin only).
- Logs: Export Guard / Export Skip / Queue Skip summaries (redacted).
- Footer: build info and last refresh time.

## Operations
- Queue: Calls `belle_queueFolderFilesToSheet()`.
- OCR Parallel Enable/Disable: Calls `belle_ocr_parallel_enable()` and `belle_ocr_parallel_disable()`.
- Export: Calls `belle_exportYayoiCsv()`.

## Data Privacy Notes
- The UI and APIs do not return OCR JSON, receipts, line items, or PII.
- Log summaries are redacted to time, reason, doc type, and numeric counts.

## Troubleshooting
- If the dashboard shows `role = none`, verify Script Properties allowlists and Web App access settings.
- If actor email is blank, confirm Workspace domain settings allow `Session.getActiveUser().getEmail()` for web apps.
- If overview/logs are empty, verify `BELLE_SHEET_ID` is set and log sheets exist.
