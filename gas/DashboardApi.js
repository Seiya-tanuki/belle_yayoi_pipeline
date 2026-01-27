// @ts-check

// NOTE: Keep comments ASCII only.

var BELLE_DASHBOARD_STATUS_BUCKETS = ["QUEUED", "PROCESSING", "DONE", "ERROR", "ERROR_RETRYABLE", "UNKNOWN"];

function belle_dashboard_truncate_(value, maxLen) {
  var raw = String(value || "");
  var limit = Number(maxLen || 0);
  if (!limit || limit <= 0) return raw;
  if (raw.length <= limit) return raw;
  return raw.slice(0, limit);
}

function belle_dashboard_buildRid_() {
  var ts = Date.now();
  var rand = "";
  try {
    rand = Utilities.getUuid().slice(0, 8);
  } catch (e) {
    rand = String(Math.random()).slice(2, 10);
  }
  return "dash_" + ts + "_" + rand;
}

function belle_dashboard_safeMessage_(err, fallback) {
  var msg = err && err.message ? err.message : String(err || "");
  msg = String(msg || "").replace(/\s+/g, " ").trim();
  if (!msg) return String(fallback || "");
  return belle_dashboard_truncate_(msg, 120);
}

function belle_dashboard_initCounts_() {
  return {
    total: 0,
    QUEUED: 0,
    PROCESSING: 0,
    DONE: 0,
    ERROR: 0,
    ERROR_RETRYABLE: 0,
    UNKNOWN: 0
  };
}

function belle_dashboard_accumulateCounts_(target, source) {
  var out = target || belle_dashboard_initCounts_();
  var src = source || {};
  var keys = Object.keys(out);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var val = Number(src[key] || 0);
    if (!isNaN(val)) out[key] += val;
  }
  return out;
}

function belle_dashboard_bucketStatus_(value) {
  var raw = String(value || "").trim().toUpperCase();
  if (!raw) return "QUEUED";
  if (raw === "ERROR_FINAL") return "ERROR";
  if (raw === "ERROR_RETRYABLE") return "ERROR_RETRYABLE";
  if (raw === "ERROR") return "ERROR";
  if (raw === "PROCESSING" || raw === "DONE" || raw === "QUEUED") return raw;
  return "UNKNOWN";
}

function belle_dashboard_buildHeaderMap_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return {};
  var row = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  var map = {};
  for (var i = 0; i < row.length; i++) {
    var name = String(row[i] || "").trim();
    if (!name) continue;
    map[name] = i;
  }
  return map;
}

function belle_dashboard_redactCounts_(value) {
  if (!value || typeof value !== "object") return {};
  var out = {};
  var keys = Object.keys(value);
  for (var i = 0; i < keys.length; i++) {
    if (i >= 12) break;
    var key = keys[i];
    var num = Number(value[key]);
    if (!isNaN(num) && isFinite(num)) out[key] = num;
  }
  return out;
}

function belle_dashboard_parseCountsJson_(raw) {
  var text = String(raw || "").trim();
  if (!text) return {};
  try {
    var parsed = JSON.parse(text);
    return belle_dashboard_redactCounts_(parsed);
  } catch (e) {
    return {};
  }
}

function belle_dashboard_handleRequest_(action, requiredRole, handler) {
  var rid = belle_dashboard_buildRid_();
  var identity = belle_dashboard_getIdentity_();
  var role = identity && identity.role ? identity.role : BELLE_DASHBOARD_ROLE_NONE;
  var actorEmail = identity && identity.actor_email ? identity.actor_email : "";
  var effectiveEmail = identity && identity.effective_email ? identity.effective_email : "";
  var identityReason = identity && identity.reason ? identity.reason : "";
  var nowIso = new Date().toISOString();
  var response;
  var requestRedacted = "";
  try {
    if (!belle_dashboard_isAuthorized_(role, requiredRole)) {
      var denyReason = identityReason === "ACTOR_EMAIL_UNAVAILABLE" ? "ACTOR_EMAIL_UNAVAILABLE" : "UNAUTHORIZED";
      var denyMessage = identityReason === "ACTOR_EMAIL_UNAVAILABLE"
        ? "Actor email unavailable."
        : "Access denied.";
      response = { ok: false, reason: denyReason, message: denyMessage, data: null };
      requestRedacted = "{\"action\":\"" + action + "\"}";
    } else {
      response = handler({ rid: rid, role: role, actorEmail: actorEmail }) || null;
      if (!response) response = { ok: false, reason: "EMPTY_RESPONSE", message: "No response from handler.", data: null };
      requestRedacted = response.requestRedacted ? String(response.requestRedacted) : "{\"action\":\"" + action + "\"}";
    }
  } catch (e) {
    response = { ok: false, reason: "EXCEPTION", message: "Server error.", data: null };
    requestRedacted = "{\"action\":\"" + action + "\"}";
  }
  var finalRes = {
    ok: response.ok === true,
    rid: rid,
    action: action,
    role: role || BELLE_DASHBOARD_ROLE_NONE,
    actor_email: actorEmail || null,
    reason: String(response.reason || (response.ok ? "OK" : "ERROR")),
    message: String(response.message || ""),
    data: response.data || null
  };
  var audit = belle_dashboard_audit_append_({
    tsIso: nowIso,
    rid: rid,
    actorEmail: actorEmail,
    effectiveEmail: effectiveEmail,
    role: role || BELLE_DASHBOARD_ROLE_NONE,
    action: action,
    requestRedacted: belle_dashboard_truncate_(requestRedacted, 500),
    ok: finalRes.ok,
    reason: finalRes.reason,
    message: finalRes.message
  });
  if (finalRes.ok && audit && audit.ok === false) {
    finalRes.ok = false;
    finalRes.reason = "AUDIT_FAILED";
    finalRes.message = "Action completed but audit log failed.";
    finalRes.data = finalRes.data || {};
    finalRes.data.audit = audit;
  } else {
    if (!finalRes.data) finalRes.data = {};
    finalRes.data.audit = audit || { ok: false, reason: "AUDIT_UNKNOWN" };
  }
  return finalRes;
}

function belle_dashboard_getBootstrap() {
  return belle_dashboard_handleRequest_("bootstrap", BELLE_DASHBOARD_ROLE_USER, function () {
    return {
      ok: true,
      reason: "OK",
      message: "Bootstrap loaded.",
      data: {
        server_time_iso: new Date().toISOString(),
        status_order: BELLE_DASHBOARD_STATUS_BUCKETS.slice()
      },
      requestRedacted: "{\"scope\":\"bootstrap\"}"
    };
  });
}

function belle_dashboard_getOverview() {
  return belle_dashboard_handleRequest_("overview", BELLE_DASHBOARD_ROLE_USER, function () {
    var props = typeof belle_cfg_getProps_ === "function"
      ? belle_cfg_getProps_()
      : PropertiesService.getScriptProperties();
    var sheetId = typeof belle_cfg_getSheetIdOrEmpty_ === "function"
      ? belle_cfg_getSheetIdOrEmpty_(props)
      : String(props.getProperty("BELLE_SHEET_ID") || "");
    if (!sheetId) {
      return { ok: false, reason: "MISSING_SHEET_ID", message: "Missing sheet id.", data: null, requestRedacted: "{\"scope\":\"overview\"}" };
    }
    var ss = SpreadsheetApp.openById(sheetId);
    var docTypes = belle_ocr_getActiveDocTypes_(props);
    var totals = belle_dashboard_initCounts_();
    var byDocType = [];
    var missingSheets = [];
    var missingHeaders = [];
    for (var i = 0; i < docTypes.length; i++) {
      var docType = docTypes[i];
      var sheetName = belle_ocr_getQueueSheetNameForDocType_(props, docType);
      var counts = belle_dashboard_initCounts_();
      var sh = ss.getSheetByName(sheetName);
      if (!sh) {
        missingSheets.push(sheetName);
        byDocType.push({ doc_type: docType, sheet_name: sheetName, counts: counts, missing: true });
        continue;
      }
      var headerMap = belle_dashboard_buildHeaderMap_(sh);
      var statusIdx = headerMap.status;
      if (statusIdx === undefined) {
        missingHeaders.push(sheetName);
        byDocType.push({ doc_type: docType, sheet_name: sheetName, counts: counts, missing: true });
        continue;
      }
      var lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        var values = sh.getRange(2, statusIdx + 1, lastRow - 1, 1).getValues();
        for (var r = 0; r < values.length; r++) {
          var bucket = belle_dashboard_bucketStatus_(values[r][0]);
          counts[bucket] = (counts[bucket] || 0) + 1;
          counts.total++;
        }
      }
      belle_dashboard_accumulateCounts_(totals, counts);
      byDocType.push({ doc_type: docType, sheet_name: sheetName, counts: counts, missing: false });
    }
    return {
      ok: true,
      reason: "OK",
      message: "Overview loaded.",
      data: {
        status_order: BELLE_DASHBOARD_STATUS_BUCKETS.slice(),
        totals: totals,
        by_doc_type: byDocType,
        missing_sheets: missingSheets,
        missing_headers: missingHeaders
      },
      requestRedacted: "{\"scope\":\"overview\"}"
    };
  });
}

function belle_dashboard_readLogSheet_(ss, sheetName, limit, kind) {
  var res = { entries: [], missing: false, sheet_name: sheetName };
  if (!sheetName) {
    res.missing = true;
    return res;
  }
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    res.missing = true;
    return res;
  }
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return res;
  var headerMap = belle_dashboard_buildHeaderMap_(sh);
  var startRow = Math.max(2, lastRow - limit + 1);
  var rows = sh.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var ts = headerMap.logged_at_iso !== undefined ? row[headerMap.logged_at_iso] : row[0];
    var reason = headerMap.reason !== undefined ? row[headerMap.reason] : "";
    var docType = headerMap.doc_type !== undefined ? row[headerMap.doc_type] : "";
    var counts = {};
    if (kind === "guard") {
      var countsRaw = headerMap.counts_json !== undefined ? row[headerMap.counts_json] : "";
      counts = belle_dashboard_parseCountsJson_(countsRaw);
    } else if (kind === "queue_skip") {
      var seen = headerMap.seen_count !== undefined ? row[headerMap.seen_count] : "";
      var seenNum = Number(seen || 0);
      counts = { seen_count: isNaN(seenNum) ? 0 : seenNum };
    } else {
      counts = { rows: 1 };
    }
    res.entries.push({
      ts_iso: String(ts || ""),
      reason: String(reason || ""),
      doc_type: String(docType || ""),
      counts: counts,
      ok: kind === "guard"
    });
  }
  return res;
}

function belle_dashboard_getLogs() {
  return belle_dashboard_handleRequest_("logs", BELLE_DASHBOARD_ROLE_USER, function () {
    var props = typeof belle_cfg_getProps_ === "function"
      ? belle_cfg_getProps_()
      : PropertiesService.getScriptProperties();
    var sheetId = typeof belle_cfg_getSheetIdOrEmpty_ === "function"
      ? belle_cfg_getSheetIdOrEmpty_(props)
      : String(props.getProperty("BELLE_SHEET_ID") || "");
    if (!sheetId) {
      return { ok: false, reason: "MISSING_SHEET_ID", message: "Missing sheet id.", data: null, requestRedacted: "{\"scope\":\"logs\"}" };
    }
    var ss = SpreadsheetApp.openById(sheetId);
    var limit = 50;
    var guardName = belle_getExportGuardLogSheetName(props);
    var skipName = belle_getSkipLogSheetName(props);
    var queueSkipName = belle_getQueueSkipLogSheetName(props);
    var guard = belle_dashboard_readLogSheet_(ss, guardName, limit, "guard");
    var skip = belle_dashboard_readLogSheet_(ss, skipName, limit, "skip");
    var queueSkip = belle_dashboard_readLogSheet_(ss, queueSkipName, limit, "queue_skip");
    var missing = [];
    if (guard.missing) missing.push(guardName);
    if (skip.missing) missing.push(skipName);
    if (queueSkip.missing) missing.push(queueSkipName);
    return {
      ok: true,
      reason: "OK",
      message: "Logs loaded.",
      data: {
        limit: limit,
        export_guard: guard.entries,
        export_skip: skip.entries,
        queue_skip: queueSkip.entries,
        missing_sheets: missing
      },
      requestRedacted: "{\"scope\":\"logs\"}"
    };
  });
}

function belle_dashboard_actionQueue() {
  return belle_dashboard_handleRequest_("queue", BELLE_DASHBOARD_ROLE_ADMIN, function () {
    try {
      var res = belle_queueFolderFilesToSheet();
      var data = {
        queued: res && res.queued ? res.queued : 0,
        queued_by_doc_type: res && res.queuedByDocType ? res.queuedByDocType : {},
        total_listed: res && res.totalListed ? res.totalListed : 0,
        skipped: res && res.skipped ? res.skipped : 0
      };
      return {
        ok: res && res.ok !== false,
        reason: res && res.ok === false ? "QUEUE_FAILED" : "OK",
        message: res && res.ok === false ? "Queue failed." : "Queue completed.",
        data: data,
        requestRedacted: "{\"action\":\"queue\"}"
      };
    } catch (e) {
      return {
        ok: false,
        reason: "QUEUE_ERROR",
        message: belle_dashboard_safeMessage_(e, "Queue failed."),
        data: null,
        requestRedacted: "{\"action\":\"queue\"}"
      };
    }
  });
}

function belle_dashboard_actionOcrEnable() {
  return belle_dashboard_handleRequest_("ocr_enable", BELLE_DASHBOARD_ROLE_ADMIN, function () {
    try {
      var res = belle_ocr_parallel_enable();
      var data = {
        requested: res && res.requested ? res.requested : 0,
        deleted_old: res && res.deletedOld ? res.deletedOld : 0,
        created_new: res && res.createdNew ? res.createdNew : 0,
        reason: res && res.reason ? res.reason : ""
      };
      return {
        ok: res && res.ok !== false,
        reason: res && res.ok === false ? "OCR_ENABLE_FAILED" : (res && res.reason ? String(res.reason) : "OK"),
        message: res && res.ok === false ? "OCR parallel enable failed." : "OCR parallel enabled.",
        data: data,
        requestRedacted: "{\"action\":\"ocr_enable\"}"
      };
    } catch (e) {
      return {
        ok: false,
        reason: "OCR_ENABLE_ERROR",
        message: belle_dashboard_safeMessage_(e, "OCR parallel enable failed."),
        data: null,
        requestRedacted: "{\"action\":\"ocr_enable\"}"
      };
    }
  });
}

function belle_dashboard_actionOcrDisable() {
  return belle_dashboard_handleRequest_("ocr_disable", BELLE_DASHBOARD_ROLE_ADMIN, function () {
    try {
      var res = belle_ocr_parallel_disable();
      var data = {
        deleted: res && res.deleted ? res.deleted : 0,
        missing: res && res.missing ? res.missing : 0,
        existed: res && res.existed ? res.existed : 0,
        enabled_before: res && res.enabledBefore === true
      };
      return {
        ok: res && res.ok !== false,
        reason: res && res.ok === false ? "OCR_DISABLE_FAILED" : "OK",
        message: res && res.ok === false ? "OCR parallel disable failed." : "OCR parallel disabled.",
        data: data,
        requestRedacted: "{\"action\":\"ocr_disable\"}"
      };
    } catch (e) {
      return {
        ok: false,
        reason: "OCR_DISABLE_ERROR",
        message: belle_dashboard_safeMessage_(e, "OCR parallel disable failed."),
        data: null,
        requestRedacted: "{\"action\":\"ocr_disable\"}"
      };
    }
  });
}

function belle_dashboard_sanitizeExportResult_(raw) {
  var res = raw || {};
  return {
    phase: res.phase || "",
    ok: res.ok === true,
    reason: res.reason || "",
    exported_rows: Number(res.exportedRows || 0),
    exported_files: Number(res.exportedFiles || 0),
    skipped: Number(res.skipped || 0),
    errors: Number(res.errors || 0)
  };
}

function belle_dashboard_actionExport() {
  return belle_dashboard_handleRequest_("export", BELLE_DASHBOARD_ROLE_ADMIN, function () {
    try {
      var res = belle_exportYayoiCsv();
      var data = belle_dashboard_sanitizeExportResult_(res);
      return {
        ok: res && res.ok !== false,
        reason: res && res.ok === false ? "EXPORT_FAILED" : String(res && res.reason ? res.reason : "OK"),
        message: res && res.ok === false ? "Export failed." : "Export completed.",
        data: data,
        requestRedacted: "{\"action\":\"export\"}"
      };
    } catch (e) {
      return {
        ok: false,
        reason: "EXPORT_ERROR",
        message: belle_dashboard_safeMessage_(e, "Export failed."),
        data: null,
        requestRedacted: "{\"action\":\"export\"}"
      };
    }
  });
}
