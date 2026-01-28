// @ts-check

// NOTE: Keep comments ASCII only.

function belle_dash_buildRid_() {
  var ts = Date.now();
  var rand = Math.floor(Math.random() * 1000000).toString(36);
  return "dash_" + ts + "_" + rand;
}

function belle_dash_shortText_(value, limit) {
  var s = String(value || "");
  var max = limit && isFinite(limit) ? Math.floor(limit) : 140;
  if (s.length > max) return s.slice(0, max);
  return s;
}

function belle_dash_result_(ok, reason, message, data) {
  return {
    ok: !!ok,
    reason: reason ? String(reason) : "",
    message: message ? String(message) : "",
    data: data === undefined ? null : data
  };
}

function belle_dash_wrap_(action, handler) {
  var rid = belle_dash_buildRid_();
  var res;
  try {
    var result = handler();
    var ok = result && typeof result.ok === "boolean" ? result.ok : true;
    var reason = result && result.reason ? String(result.reason) : (ok ? "OK" : "ERROR");
    var message = result && result.message ? String(result.message) : (ok ? "OK" : "Request failed");
    var data = result && result.data !== undefined ? result.data : null;
    res = { ok: ok, rid: rid, action: action, reason: reason, message: message, data: data };
    return belle_dash_attachAudit_(res);
  } catch (e) {
    var msg = belle_dash_shortText_(e && e.message ? e.message : e, 120);
    res = { ok: false, rid: rid, action: action, reason: "EXCEPTION", message: msg, data: null };
    return belle_dash_attachAudit_(res);
  }
}

function belle_dash_attachAudit_(result) {
  if (!result) return result;
  if (typeof belle_dash_audit_append_ !== "function") return result;
  var audit = belle_dash_audit_append_({
    rid: result.rid,
    action: result.action,
    ok: result.ok,
    reason: result.reason,
    message: result.message
  });
  if (audit && audit.written === false) {
    var data = result.data;
    if (data === null || data === undefined) data = {};
    else if (typeof data !== "object") data = { value: data };
    data.audit_log = {
      written: false,
      reason: audit.reason ? String(audit.reason) : "AUDIT_WRITE_FAILED"
    };
    result.data = data;
  }
  return result;
}

function belle_dash_buildHeaderMap_(headerRow) {
  var map = {};
  var row = Array.isArray(headerRow) ? headerRow : [];
  for (var i = 0; i < row.length; i++) {
    map[String(row[i] || "")] = i;
  }
  return map;
}

function belle_dash_getCell_(row, map, key) {
  if (!map) return "";
  var idx = map[key];
  if (idx === undefined) return "";
  return row && row[idx] !== undefined ? row[idx] : "";
}

function belle_dash_toNumber_(value) {
  var n = Number(value);
  if (isNaN(n)) return null;
  return n;
}

function belle_dash_parseCountsJson_(raw) {
  if (!raw) return null;
  try {
    var parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      total: belle_dash_toNumber_(parsed.total),
      done: belle_dash_toNumber_(parsed.done),
      queued: belle_dash_toNumber_(parsed.queued),
      retryable: belle_dash_toNumber_(parsed.retryable),
      error_final: belle_dash_toNumber_(parsed.error_final)
    };
  } catch (e) {
    return null;
  }
}

function belle_dash_getOverview() {
  return belle_dash_wrap_("overview", function () {
    var props = belle_cfg_getProps_();
    var sheetId = belle_cfg_getSheetIdOrEmpty_(props);
    if (!sheetId) {
      return belle_dash_result_(false, "MISSING_SHEET_ID", "Missing BELLE_SHEET_ID.", null);
    }

    var ss = SpreadsheetApp.openById(sheetId);
    var activeDocTypes = belle_ocr_getActiveDocTypes_(props);
    var baseHeader = belle_getQueueHeaderColumns();
    var extraHeader = belle_getQueueLockHeaderColumns_();

    function emptyCounts() {
      return {
        queued: 0,
        processing: 0,
        done: 0,
        error: 0,
        error_retryable: 0,
        unknown: 0,
        total: 0
      };
    }

    var totals = emptyCounts();
    var out = [];

    for (var i = 0; i < activeDocTypes.length; i++) {
      var docType = activeDocTypes[i];
      var spec = belle_docType_getSpec_(docType);
      if (!spec) continue;
      var sheetName = belle_ocr_getQueueSheetNameForDocType_(props, docType);
      var entry = {
        docType: spec.doc_type,
        queueSheetName: sheetName,
        missing: false,
        invalidHeader: false,
        counts: emptyCounts()
      };
      var sh = ss.getSheetByName(sheetName);
      if (!sh) {
        entry.missing = true;
        out.push(entry);
        continue;
      }

      var headerMap = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader, { appendMissing: false });
      if (!headerMap || headerMap.status === undefined || headerMap.file_id === undefined) {
        entry.invalidHeader = true;
        out.push(entry);
        continue;
      }

      var lastRow = sh.getLastRow();
      if (lastRow < 2) {
        out.push(entry);
        continue;
      }

      var statusCol = headerMap.status + 1;
      var fileIdCol = headerMap.file_id + 1;
      var rowCount = lastRow - 1;
      var statuses = sh.getRange(2, statusCol, rowCount, 1).getValues();
      var fileIds = sh.getRange(2, fileIdCol, rowCount, 1).getValues();
      for (var r = 0; r < rowCount; r++) {
        var fileId = String(fileIds[r][0] || "");
        if (!fileId) continue;
        var raw = String(statuses[r][0] || "").trim().toUpperCase();
        entry.counts.total++;
        if (raw === "QUEUED") entry.counts.queued++;
        else if (raw === "PROCESSING") entry.counts.processing++;
        else if (raw === "DONE") entry.counts.done++;
        else if (raw === "ERROR") entry.counts.error++;
        else if (raw === "ERROR_RETRYABLE") entry.counts.error_retryable++;
        else entry.counts.unknown++;
      }

      totals.queued += entry.counts.queued;
      totals.processing += entry.counts.processing;
      totals.done += entry.counts.done;
      totals.error += entry.counts.error;
      totals.error_retryable += entry.counts.error_retryable;
      totals.unknown += entry.counts.unknown;
      totals.total += entry.counts.total;
      out.push(entry);
    }

    return belle_dash_result_(true, "OK", "Overview ready.", {
      docTypes: out,
      totals: totals
    });
  });
}

function belle_dash_readLogSheet_(ss, sheetName, limit, mapRow) {
  if (!sheetName) return { sheetName: sheetName, missing: true, rows: [], totalRows: 0 };
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { sheetName: sheetName, missing: true, rows: [], totalRows: 0 };
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { sheetName: sheetName, missing: false, rows: [], totalRows: 0 };
  var lastCol = sh.getLastColumn();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = belle_dash_buildHeaderMap_(header);
  var startRow = Math.max(2, lastRow - limit + 1);
  var numRows = lastRow - startRow + 1;
  var values = sh.getRange(startRow, 1, numRows, lastCol).getValues();
  var out = [];
  for (var i = values.length - 1; i >= 0; i--) {
    var row = values[i];
    var mapped = mapRow(row, map);
    if (mapped) out.push(mapped);
  }
  return { sheetName: sheetName, missing: false, rows: out, totalRows: lastRow - 1 };
}

function belle_dash_mapGuardRow_(row, map) {
  var ts = belle_dash_shortText_(belle_dash_getCell_(row, map, "logged_at_iso"), 64);
  var reason = belle_dash_shortText_(belle_dash_getCell_(row, map, "reason"), 80);
  var docType = belle_dash_shortText_(belle_dash_getCell_(row, map, "doc_type"), 40);
  var counts = belle_dash_parseCountsJson_(belle_dash_getCell_(row, map, "counts_json"));
  return {
    ts_iso: ts,
    reason: reason,
    doc_type: docType,
    counts: counts
  };
}

function belle_dash_mapExportSkipRow_(row, map) {
  var ts = belle_dash_shortText_(belle_dash_getCell_(row, map, "logged_at_iso"), 64);
  var reason = belle_dash_shortText_(belle_dash_getCell_(row, map, "reason"), 80);
  var docType = belle_dash_shortText_(belle_dash_getCell_(row, map, "doc_type"), 40);
  return {
    ts_iso: ts,
    reason: reason,
    doc_type: docType
  };
}

function belle_dash_mapQueueSkipRow_(row, map) {
  var ts = belle_dash_shortText_(belle_dash_getCell_(row, map, "logged_at_iso"), 64);
  var reason = belle_dash_shortText_(belle_dash_getCell_(row, map, "reason"), 80);
  var docType = belle_dash_shortText_(belle_dash_getCell_(row, map, "doc_type"), 40);
  var seen = belle_dash_toNumber_(belle_dash_getCell_(row, map, "seen_count"));
  return {
    ts_iso: ts,
    reason: reason,
    doc_type: docType,
    seen_count: seen
  };
}

function belle_dash_getLogs() {
  return belle_dash_wrap_("logs", function () {
    var props = belle_cfg_getProps_();
    var sheetId = belle_cfg_getSheetIdOrEmpty_(props);
    if (!sheetId) {
      return belle_dash_result_(false, "MISSING_SHEET_ID", "Missing BELLE_SHEET_ID.", null);
    }
    var ss = SpreadsheetApp.openById(sheetId);
    var limit = 50;
    var exportGuardName = belle_getExportGuardLogSheetName(props);
    var exportSkipName = belle_getSkipLogSheetName(props);
    var queueSkipName = belle_getQueueSkipLogSheetName(props);
    var exportGuard = belle_dash_readLogSheet_(ss, exportGuardName, limit, belle_dash_mapGuardRow_);
    var exportSkip = belle_dash_readLogSheet_(ss, exportSkipName, limit, belle_dash_mapExportSkipRow_);
    var queueSkip = belle_dash_readLogSheet_(ss, queueSkipName, limit, belle_dash_mapQueueSkipRow_);
    return belle_dash_result_(true, "OK", "Logs ready.", {
      limit: limit,
      sheets: {
        exportGuard: exportGuard,
        exportSkip: exportSkip,
        queueSkip: queueSkip
      }
    });
  });
}

function belle_dash_opQueue() {
  return belle_dash_wrap_("op_queue", function () {
    var gate = belle_maint_requireMode_("OCR");
    if (!gate.ok) return gate;
    var res = belle_queueFolderFilesToSheet();
    var queued = res && res.queued ? Number(res.queued) : 0;
    var skipped = res && res.skipped ? Number(res.skipped) : 0;
    var listed = res && res.totalListed ? Number(res.totalListed) : 0;
    return belle_dash_result_(true, "OK", "Queue complete.", {
      queued: queued,
      skipped: skipped,
      totalListed: listed,
      queuedByDocType: (res && res.queuedByDocType) || {}
    });
  });
}

function belle_dash_opOcrEnable() {
  return belle_dash_wrap_("op_ocr_enable", function () {
    var gate = belle_maint_requireMode_("OCR");
    if (!gate.ok) return gate;
    var res = belle_ocr_parallel_enable();
    if (res && res.reason) {
      return belle_dash_result_(false, "OCR_ENABLE_BLOCKED", "OCR enable blocked: " + res.reason, {
        reason: res.reason,
        requested: res.requested || null
      });
    }
    return belle_dash_result_(true, "OK", "OCR parallel enabled.", {
      created: res && res.createdNew ? res.createdNew : 0,
      deletedOld: res && res.deletedOld ? res.deletedOld : 0
    });
  });
}

function belle_dash_opOcrDisable() {
  return belle_dash_wrap_("op_ocr_disable", function () {
    var gate = belle_maint_requireMode_("OCR");
    if (!gate.ok) return gate;
    var res = belle_ocr_parallel_disable();
    return belle_dash_result_(true, "OK", "OCR parallel disabled.", {
      deleted: res && res.deleted ? res.deleted : 0,
      existed: res && res.existed ? res.existed : 0
    });
  });
}

function belle_dash_opExport() {
  return belle_dash_wrap_("op_export", function () {
    var gate = belle_maint_requireMode_("MAINTENANCE");
    if (!gate.ok) return gate;
    return belle_export_run_maintenance_();
  });
}

function belle_dash_getMode() {
  return belle_dash_wrap_("mode_get", function () {
    return belle_dash_maint_getState_();
  });
}

function belle_dash_enterMaintenance() {
  return belle_dash_wrap_("maint_enter", function () {
    var gate = belle_maint_requireMode_("OCR");
    if (!gate.ok) return gate;
    return belle_dash_maint_enter_();
  });
}

function belle_dash_exitMaintenance() {
  return belle_dash_wrap_("maint_exit", function () {
    var gate = belle_maint_requireMode_("MAINTENANCE");
    if (!gate.ok) return gate;
    return belle_dash_maint_exit_();
  });
}

function belle_dash_archiveLogs() {
  return belle_dash_wrap_("maint_archive_logs", function () {
    var gate = belle_maint_requireMode_("MAINTENANCE");
    if (!gate.ok) return gate;
    return belle_dash_maint_archiveLogs_();
  });
}

function belle_dash_exportRun() {
  return belle_dash_wrap_("maint_export_run", function () {
    var gate = belle_maint_requireMode_("MAINTENANCE");
    if (!gate.ok) return gate;
    return belle_dash_maint_exportRun_();
  });
}
