// @ts-check

// NOTE: Keep comments ASCII only.

function belle_dash_audit_trim_(value, limit) {
  var s = String(value || "");
  var max = limit && isFinite(limit) ? Math.floor(limit) : 120;
  if (s.length > max) return s.slice(0, max);
  return s;
}

function belle_dash_audit_getSheet_() {
  var props = belle_cfg_getProps_();
  var integrationsId = String(props.getProperty("BELLE_INTEGRATIONS_SHEET_ID") || "").trim();
  if (!integrationsId) {
    return { sheet: null, reason: "INTEGRATIONS_SHEET_ID_MISSING" };
  }
  var ss;
  try {
    ss = SpreadsheetApp.openById(integrationsId);
  } catch (e) {
    return { sheet: null, reason: "INTEGRATIONS_SHEET_OPEN_FAILED" };
  }
  var name = "DASHBOARD_AUDIT_LOG";
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var header = ["ts_iso", "rid", "action", "ok", "reason", "message"];
  var lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  } else {
    var row = sh.getRange(1, 1, 1, header.length).getValues()[0];
    var hasAny = false;
    for (var i = 0; i < row.length; i++) {
      if (String(row[i] || "") !== "") {
        hasAny = true;
        break;
      }
    }
    if (!hasAny) {
      sh.getRange(1, 1, 1, header.length).setValues([header]);
    }
  }
  return { sheet: sh, reason: "OK" };
}

function belle_dash_audit_append_(entry) {
  try {
    var res = belle_dash_audit_getSheet_();
    if (!res.sheet) return { written: false, reason: res.reason || "INTEGRATIONS_SHEET_MISSING" };
    var e = entry || {};
    var ts = e.ts_iso ? String(e.ts_iso) : new Date().toISOString();
    var row = [
      ts,
      belle_dash_audit_trim_(e.rid, 80),
      belle_dash_audit_trim_(e.action, 60),
      e.ok === true,
      belle_dash_audit_trim_(e.reason, 80),
      belle_dash_audit_trim_(e.message, 160)
    ];
    res.sheet.appendRow(row);
    return { written: true };
  } catch (e) {
    return { written: false, reason: "AUDIT_WRITE_FAILED" };
  }
}
