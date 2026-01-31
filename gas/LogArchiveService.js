// @ts-check

// NOTE: Keep comments ASCII only.

function belle_archive_getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function belle_archive_getReportFolder_(when) {
  var props = belle_cfg_getProps_();
  var rootId = String(props.getProperty("BELLE_LOG_ARCHIVE_FOLDER_ID") || "").trim();
  if (!rootId) {
    return { ok: false, reason: "ARCHIVE_FOLDER_ID_MISSING", message: "Missing BELLE_LOG_ARCHIVE_FOLDER_ID." };
  }
  var root;
  try {
    root = DriveApp.getFolderById(rootId);
  } catch (e) {
    return { ok: false, reason: "ARCHIVE_FOLDER_OPEN_FAILED", message: "Archive folder open failed." };
  }
  var ts = when || new Date();
  var tz = Session.getScriptTimeZone();
  var year = Utilities.formatDate(ts, tz, "yyyy");
  var month = Utilities.formatDate(ts, tz, "MM");
  var reports = belle_archive_getOrCreateFolder_(root, "export_run_reports");
  var yearFolder = belle_archive_getOrCreateFolder_(reports, year);
  var monthFolder = belle_archive_getOrCreateFolder_(yearFolder, month);
  return {
    ok: true,
    folder: monthFolder,
    path: "export_run_reports/" + year + "/" + month
  };
}

function belle_archive_clearSheetRows_(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return 0;
  var deleteCount = lastRow - 1;
  sh.deleteRows(2, deleteCount);
  return deleteCount;
}

function belle_archive_copySheet_(source, dest, name) {
  var copied = source.copyTo(dest);
  copied.setName(name);
  return copied;
}

function belle_logArchive_archiveLogs_() {
  var props = belle_cfg_getProps_();
  var integrationsId = String(props.getProperty("BELLE_INTEGRATIONS_SHEET_ID") || "").trim();
  if (!integrationsId) {
    return { ok: false, reason: "INTEGRATIONS_SHEET_ID_MISSING", message: "Missing BELLE_INTEGRATIONS_SHEET_ID.", data: null };
  }
  var ss;
  try {
    ss = SpreadsheetApp.openById(integrationsId);
  } catch (e) {
    return { ok: false, reason: "INTEGRATIONS_SHEET_OPEN_FAILED", message: "Integrations sheet open failed.", data: null };
  }

  var targets = ["PERF_LOG", "DASHBOARD_AUDIT_LOG"];
  var sheets = {};
  var missing = [];
  for (var i = 0; i < targets.length; i++) {
    var sh = ss.getSheetByName(targets[i]);
    if (!sh) missing.push(targets[i]);
    else sheets[targets[i]] = sh;
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "LOG_SHEET_MISSING",
      message: "Missing log sheets.",
      data: { missing: missing }
    };
  }

  var folderRes = belle_archive_getReportFolder_(new Date());
  if (!folderRes.ok) {
    return { ok: false, reason: folderRes.reason, message: folderRes.message || "Archive folder error.", data: null };
  }

  var name = belle_archive_buildName_("logs_archive");
  var archiveSs = SpreadsheetApp.create(name);
  var archiveFile = DriveApp.getFileById(archiveSs.getId());
  archiveFile.moveTo(folderRes.folder);

  try {
    for (var j = 0; j < targets.length; j++) {
      var sheetName = targets[j];
      belle_archive_copySheet_(sheets[sheetName], archiveSs, sheetName);
    }
    var defaultSheet = archiveSs.getSheetByName("Sheet1");
    if (defaultSheet && archiveSs.getSheets().length > targets.length) {
      archiveSs.deleteSheet(defaultSheet);
    }
  } catch (e) {
    return {
      ok: false,
      reason: "ARCHIVE_COPY_FAILED",
      message: "Failed to copy log sheets.",
      data: { archive_id: archiveSs.getId(), archive_name: name }
    };
  }

  var cleared = {};
  for (var k = 0; k < targets.length; k++) {
    var targetName = targets[k];
    cleared[targetName] = belle_archive_clearSheetRows_(sheets[targetName]);
  }

  return {
    ok: true,
    reason: "OK",
    message: "Logs archived and cleared.",
    data: {
      archive_id: archiveSs.getId(),
      archive_name: name,
      folder_path: folderRes.path,
      cleared: cleared
    }
  };
}
