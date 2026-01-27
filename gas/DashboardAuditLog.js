// @ts-check

// NOTE: Keep comments ASCII only.

var BELLE_DASHBOARD_AUDIT_SHEET_NAME = "DASHBOARD_AUDIT_LOG";
var BELLE_DASHBOARD_AUDIT_HEADER = [
  "ts_iso",
  "rid",
  "actor_email",
  "role",
  "action",
  "request_redacted",
  "ok",
  "reason",
  "message"
];

function belle_dashboard_audit_buildRow_(entry) {
  var row = new Array(BELLE_DASHBOARD_AUDIT_HEADER.length);
  for (var i = 0; i < row.length; i++) row[i] = "";
  var e = entry || {};
  row[0] = e.tsIso || new Date().toISOString();
  row[1] = String(e.rid || "");
  row[2] = String(e.actorEmail || "");
  row[3] = String(e.role || "");
  row[4] = String(e.action || "");
  row[5] = String(e.requestRedacted || "");
  row[6] = e.ok === true;
  row[7] = String(e.reason || "");
  row[8] = String(e.message || "");
  return row;
}

function belle_dashboard_audit_ensureHeader_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol === 0) {
    sh.getRange(1, 1, 1, BELLE_DASHBOARD_AUDIT_HEADER.length).setValues([BELLE_DASHBOARD_AUDIT_HEADER]);
    return;
  }
  var headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var nextCol = headerRow.length + 1;
  for (var i = 0; i < BELLE_DASHBOARD_AUDIT_HEADER.length; i++) {
    if (headerRow.indexOf(BELLE_DASHBOARD_AUDIT_HEADER[i]) === -1) {
      sh.getRange(1, nextCol).setValue(BELLE_DASHBOARD_AUDIT_HEADER[i]);
      nextCol++;
    }
  }
}

function belle_dashboard_audit_append_(entry) {
  try {
    var props = typeof belle_cfg_getProps_ === "function"
      ? belle_cfg_getProps_()
      : PropertiesService.getScriptProperties();
    var sheetId = typeof belle_cfg_getSheetIdOrEmpty_ === "function"
      ? belle_cfg_getSheetIdOrEmpty_(props)
      : String(props.getProperty("BELLE_SHEET_ID") || "");
    if (!sheetId) {
      return { ok: false, reason: "MISSING_SHEET_ID", message: "Missing sheet id." };
    }
    var ss = SpreadsheetApp.openById(sheetId);
    var sh = ss.getSheetByName(BELLE_DASHBOARD_AUDIT_SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(BELLE_DASHBOARD_AUDIT_SHEET_NAME);
    }
    belle_dashboard_audit_ensureHeader_(sh);
    var row = belle_dashboard_audit_buildRow_(entry);
    sh.appendRow(row);
    return { ok: true };
  } catch (e) {
    var msg = e && e.message ? e.message : String(e);
    return { ok: false, reason: "AUDIT_ERROR", message: String(msg || "").slice(0, 120) };
  }
}
