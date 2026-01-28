// @ts-check

// NOTE: Keep comments ASCII only.

function belle_export_run_buildRunId_(when) {
  var ts = when || new Date();
  var tz = Session.getScriptTimeZone();
  var stamp = Utilities.formatDate(ts, tz, "yyyyMMdd_HHmmss");
  var rand = Math.floor(Math.random() * 1000000).toString(36);
  return stamp + "_" + rand;
}

function belle_export_run_extractCsvFiles_(exportRes) {
  var out = [];
  function add(docType, res) {
    if (!res || !res.csvFileId) return;
    var fileId = String(res.csvFileId || "");
    if (!fileId) return;
    var name = "";
    try {
      name = DriveApp.getFileById(fileId).getName();
    } catch (e) {
      name = "";
    }
    out.push({ doc_type: docType, file_id: fileId, name: name });
  }
  if (exportRes) {
    var docType = exportRes.doc_type ? String(exportRes.doc_type) : "";
    add(docType || BELLE_DOC_TYPE_RECEIPT, exportRes);
    if (exportRes[BELLE_DOC_TYPE_CC_STATEMENT]) add(BELLE_DOC_TYPE_CC_STATEMENT, exportRes[BELLE_DOC_TYPE_CC_STATEMENT]);
    if (exportRes[BELLE_DOC_TYPE_BANK_STATEMENT]) add(BELLE_DOC_TYPE_BANK_STATEMENT, exportRes[BELLE_DOC_TYPE_BANK_STATEMENT]);
  }
  return out;
}

function belle_export_run_collectCounts_(ss, props) {
  var docTypes = [BELLE_DOC_TYPE_RECEIPT, BELLE_DOC_TYPE_CC_STATEMENT, BELLE_DOC_TYPE_BANK_STATEMENT];
  var counts = {};
  for (var i = 0; i < docTypes.length; i++) {
    var docType = docTypes[i];
    var sheetName = belle_ocr_getQueueSheetNameForDocType_(props, docType);
    var sh = ss.getSheetByName(sheetName);
    var entry = { queued: 0, done: 0, error: 0, retryable: 0, missing: false };
    if (!sh) {
      entry.missing = true;
      counts[docType] = entry;
      continue;
    }
    var lastRow = sh.getLastRow();
    if (lastRow < 2) {
      counts[docType] = entry;
      continue;
    }
    var lastCol = sh.getLastColumn();
    var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var map = {};
    for (var h = 0; h < header.length; h++) {
      map[String(header[h] || "")] = h;
    }
    if (map.status === undefined) {
      entry.missing = true;
      counts[docType] = entry;
      continue;
    }
    var rowCount = lastRow - 1;
    var statusVals = sh.getRange(2, map.status + 1, rowCount, 1).getValues();
    for (var r = 0; r < rowCount; r++) {
      var status = String(statusVals[r][0] || "");
      if (status === "DONE") entry.done++;
      else if (status === "ERROR_FINAL") entry.error++;
      else if (status === "ERROR_RETRYABLE" || status === "ERROR") entry.retryable++;
      else entry.queued++;
    }
    counts[docType] = entry;
  }
  return counts;
}

function belle_export_run_clearSheet_(sh) {
  if (!sh) return { deleted: 0, missing: true };
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return { deleted: 0, missing: false };
  var deleteCount = lastRow - 1;
  sh.deleteRows(2, deleteCount);
  return { deleted: deleteCount, missing: false };
}

function belle_export_run_createReport_(sheetId, runId) {
  var folderRes = belle_archive_getReportFolder_(new Date());
  if (!folderRes.ok) {
    return { ok: false, reason: folderRes.reason, message: folderRes.message || "Archive folder error." };
  }
  var tz = Session.getScriptTimeZone();
  var ts = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HHmmss");
  var name = "Export Run Report " + ts;
  var file;
  try {
    file = DriveApp.getFileById(sheetId).makeCopy(name, folderRes.folder);
  } catch (e) {
    return { ok: false, reason: "REPORT_COPY_FAILED", message: "Report copy failed." };
  }
  var reportId = file.getId();
  try {
    var reportSs = SpreadsheetApp.openById(reportId);
    var summary = reportSs.getSheetByName("Summary");
    if (!summary) reportSs.insertSheet("Summary");
  } catch (e) {
    return { ok: false, reason: "REPORT_SHEET_FAILED", message: "Failed to prepare summary sheet.", data: { report_id: reportId } };
  }
  return {
    ok: true,
    report_id: reportId,
    report_name: name,
    folder_path: folderRes.path,
    run_id: runId
  };
}

function belle_export_run_writeSummary_(reportId, summary) {
  var ss = SpreadsheetApp.openById(reportId);
  var sh = ss.getSheetByName("Summary");
  if (!sh) sh = ss.insertSheet("Summary");
  sh.clear();

  var exportRes = summary.export || {};
  var csvFiles = summary.csv_files || [];
  var csvNames = [];
  for (var i = 0; i < csvFiles.length; i++) {
    var entry = csvFiles[i];
    var label = entry.name ? entry.name : entry.file_id;
    if (entry.doc_type) label = entry.doc_type + ":" + label;
    csvNames.push(label);
  }

  var rows = [];
  rows.push(["run_id", summary.run_id || ""]);
  rows.push(["created_at", summary.created_at || ""]);
  rows.push(["export_ok", exportRes.ok === true]);
  rows.push(["export_reason", exportRes.reason || ""]);
  rows.push(["export_message", exportRes.message || ""]);
  rows.push(["export_phase", exportRes.phase || ""]);
  rows.push(["report_folder_path", summary.report_folder_path || ""]);
  rows.push(["csv_files", csvNames.join(", ")]);
  rows.push([]);
  rows.push(["Doc Type Counts"]);
  rows.push(["doc_type", "queued", "done", "error", "retryable"]);
  var counts = summary.counts || {};
  var docTypes = [BELLE_DOC_TYPE_RECEIPT, BELLE_DOC_TYPE_CC_STATEMENT, BELLE_DOC_TYPE_BANK_STATEMENT];
  for (var d = 0; d < docTypes.length; d++) {
    var key = docTypes[d];
    var c = counts[key] || {};
    rows.push([key, c.queued || 0, c.done || 0, c.error || 0, c.retryable || 0]);
  }
  rows.push([]);
  rows.push(["Image Archive"]);
  rows.push(["doc_type", "moved", "failed"]);
  var archive = summary.archive || {};
  var moved = archive.moved || {};
  var failed = archive.failed || {};
  for (var a = 0; a < docTypes.length; a++) {
    var typeKey = docTypes[a];
    rows.push([typeKey, moved[typeKey] || 0, failed[typeKey] || 0]);
  }
  rows.push([]);
  rows.push(["Clear Results"]);
  rows.push(["sheet_name", "rows_deleted", "missing"]);
  var clear = summary.clear || {};
  var clearKeys = Object.keys(clear);
  if (clearKeys.length === 0) {
    rows.push(["(none)", 0, ""]);
  } else {
    for (var cidx = 0; cidx < clearKeys.length; cidx++) {
      var sheetName = clearKeys[cidx];
      var info = clear[sheetName] || {};
      rows.push([sheetName, info.deleted || 0, info.missing ? "missing" : ""]);
    }
  }

  var width = 0;
  for (var w = 0; w < rows.length; w++) {
    if (rows[w].length > width) width = rows[w].length;
  }
  for (var r = 0; r < rows.length; r++) {
    while (rows[r].length < width) rows[r].push("");
  }
  sh.getRange(1, 1, rows.length, width).setValues(rows);
}

function belle_export_run_maintenance_() {
  var startMs = Date.now();
  var runId = belle_export_run_buildRunId_(new Date());
  var props = belle_cfg_getProps_();
  var sheetId = belle_cfg_getSheetIdOrEmpty_(props);
  if (!sheetId) {
    return { ok: false, reason: "MISSING_SHEET_ID", message: "Missing BELLE_SHEET_ID.", data: { run_id: runId } };
  }

  var exportRes;
  try {
    exportRes = belle_exportYayoiCsv();
  } catch (e) {
    return { ok: false, reason: "EXPORT_EXCEPTION", message: "Export failed.", data: { run_id: runId } };
  }

  if (!exportRes || exportRes.ok !== true || exportRes.phase === "EXPORT_GUARD" || exportRes.phase === "EXPORT_ERROR") {
    var blockReason = exportRes && exportRes.reason ? String(exportRes.reason) : "EXPORT_FAILED";
    var blockMsg = exportRes && exportRes.phase === "EXPORT_GUARD" ? "Export blocked: " + blockReason : "Export failed.";
    return {
      ok: false,
      reason: "EXPORT_BLOCKED",
      message: blockMsg,
      data: { run_id: runId, export: exportRes || null }
    };
  }

  var imagesRootId = String(props.getProperty("BELLE_IMAGES_ARCHIVE_FOLDER_ID") || "").trim();
  if (!imagesRootId) {
    return {
      ok: false,
      reason: "IMAGES_ARCHIVE_FOLDER_ID_MISSING",
      message: "Missing BELLE_IMAGES_ARCHIVE_FOLDER_ID.",
      data: { run_id: runId, export: exportRes || null }
    };
  }
  try {
    DriveApp.getFolderById(imagesRootId);
  } catch (e) {
    return {
      ok: false,
      reason: "IMAGES_ARCHIVE_FOLDER_OPEN_FAILED",
      message: "Archive folder open failed.",
      data: { run_id: runId, export: exportRes || null }
    };
  }

  var ss = SpreadsheetApp.openById(sheetId);
  var counts = belle_export_run_collectCounts_(ss, props);
  var csvFiles = belle_export_run_extractCsvFiles_(exportRes);
  var reportRes = belle_export_run_createReport_(sheetId, runId);
  if (!reportRes.ok) {
    return {
      ok: false,
      reason: reportRes.reason || "REPORT_FAILED",
      message: reportRes.message || "Report failed.",
      data: { run_id: runId, export: exportRes || null }
    };
  }

  var archiveRes = belle_image_archive_run_();
  var summaryData = {
    run_id: runId,
    created_at: new Date().toISOString(),
    export: {
      ok: exportRes.ok === true,
      reason: exportRes.reason || "",
      message: exportRes.reason ? "Export " + exportRes.reason : "Export completed.",
      phase: exportRes.phase || ""
    },
    counts: counts,
    csv_files: csvFiles,
    report_folder_path: reportRes.folder_path,
    archive: archiveRes && archiveRes.data ? archiveRes.data : {},
    clear: {}
  };

  if (!archiveRes.ok) {
    belle_export_run_writeSummary_(reportRes.report_id, summaryData);
    return {
      ok: false,
      reason: archiveRes.reason || "ARCHIVE_FAILED",
      message: archiveRes.message || "Image archive failed.",
      data: {
        run_id: runId,
        report: reportRes,
        export: exportRes || null,
        archive: archiveRes.data || null
      }
    };
  }

  var sheetNames = [
    belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_RECEIPT),
    belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_CC_STATEMENT),
    belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_BANK_STATEMENT),
    "EXPORT_LOG",
    belle_getSkipLogSheetName(props),
    belle_getQueueSkipLogSheetName(props),
    belle_getExportGuardLogSheetName(props)
  ];
  var cleared = {};
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    if (!name) continue;
    var sh = ss.getSheetByName(name);
    cleared[name] = belle_export_run_clearSheet_(sh);
  }

  summaryData.clear = cleared;
  belle_export_run_writeSummary_(reportRes.report_id, summaryData);

  var totalMs = Date.now() - startMs;
  return {
    ok: true,
    reason: "OK",
    message: "Export run completed.",
    data: {
      run_id: runId,
      report: reportRes,
      export: exportRes || null,
      archive: archiveRes.data || null,
      clear: cleared,
      timing_ms: { total: totalMs }
    }
  };
}
