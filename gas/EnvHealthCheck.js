// @ts-check

// NOTE: Keep comments ASCII only.

function belle_env_maskId_(value) {
  var s = String(value || "");
  if (!s) return "";
  if (s.length <= 10) return s;
  return s.slice(0, 6) + "..." + s.slice(-4);
}

function belle_env_addDiag_(list, item, code, detail, hint) {
  list.push({
    item: String(item || ""),
    code: String(code || ""),
    detail: String(detail || ""),
    hint: String(hint || "")
  });
}

function belle_env_requireString_(props, key, diags, opts) {
  var options = opts || {};
  var raw = String(props.getProperty(key) || "").trim();
  if (!raw) {
    belle_env_addDiag_(diags, key, "MISSING", "(missing)", "Set Script Property " + key + ".");
    return "";
  }
  if (options.redact) return raw;
  return raw;
}

function belle_env_parseIntInRange_(raw, min, max) {
  var n = Number(raw);
  if (!isFinite(n) || Math.floor(n) !== n) return { ok: false, reason: "INVALID_NUMBER" };
  if (n < min || n > max) return { ok: false, reason: "OUT_OF_RANGE" };
  return { ok: true, value: n };
}

function belle_env_getOrCreateFolder_(parent, name, allowCreate) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return { ok: true, folder: it.next(), created: false };
  if (!allowCreate) return { ok: false, reason: "MISSING" };
  try {
    var created = parent.createFolder(name);
    return { ok: true, folder: created, created: true };
  } catch (e) {
    return { ok: false, reason: "CREATE_FAILED" };
  }
}

function belle_env_ensureQueueSheet_(ss, sheetName, ensured) {
  try {
    var sh = ss.getSheetByName(sheetName);
    var created = false;
    if (!sh) {
      sh = ss.insertSheet(sheetName);
      created = true;
    }
    var baseHeader = belle_getQueueHeaderColumns();
    var extraHeader = belle_getQueueLockHeaderColumns_();
    var map = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader, { appendMissing: true, throwOnMissing: false });
    if (!map) return { ok: false, reason: "INVALID_QUEUE_HEADER" };
    if (created) ensured.sheets_created.push(sheetName);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "EXCEPTION" };
  }
}

function belle_env_ensureLogSheet_(ss, sheetName, header, ensured) {
  try {
    var res = belle_log_ensureSheetWithHeader_(ss, sheetName, header);
    if (res && res.created) ensured.sheets_created.push(sheetName);
    if (res && res.rotated) ensured.headers_rotated.push(sheetName);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "EXCEPTION" };
  }
}

function belle_env_ensureExportLogSheet_(ss, ensured) {
  try {
    var legacy = ss.getSheetByName("IMPORT_LOG");
    var existing = ss.getSheetByName("EXPORT_LOG");
    if (!existing && legacy) {
      return { ok: false, reason: "LEGACY_IMPORT_LOG" };
    }
    var header = belle_getExportLogHeaderColumns();
    return belle_env_ensureLogSheet_(ss, "EXPORT_LOG", header, ensured);
  } catch (e) {
    return { ok: false, reason: "EXCEPTION" };
  }
}

function belle_env_healthCheck_(opts) {
  var options = opts || {};
  var ensure = options.ensure === true;
  var props = belle_cfg_getProps_();
  var diagnostics = [];
  var ensured = { sheets_created: [], folders_created: [], headers_rotated: [] };

  var sheetId = belle_env_requireString_(props, "BELLE_SHEET_ID", diagnostics);
  var integrationsId = belle_env_requireString_(props, "BELLE_INTEGRATIONS_SHEET_ID", diagnostics);
  var driveFolderId = belle_env_requireString_(props, "BELLE_DRIVE_FOLDER_ID", diagnostics);
  var logArchiveId = belle_env_requireString_(props, "BELLE_LOG_ARCHIVE_FOLDER_ID", diagnostics);
  var imagesArchiveId = belle_env_requireString_(props, "BELLE_IMAGES_ARCHIVE_FOLDER_ID", diagnostics);
  var apiKey = belle_env_requireString_(props, "BELLE_GEMINI_API_KEY", diagnostics, { redact: true });
  var model = belle_env_requireString_(props, "BELLE_GEMINI_MODEL", diagnostics);
  var outputFolderId = belle_env_requireString_(props, "BELLE_OUTPUT_FOLDER_ID", diagnostics);
  var fiscalStart = belle_env_requireString_(props, "BELLE_FISCAL_START_DATE", diagnostics);
  var fiscalEnd = belle_env_requireString_(props, "BELLE_FISCAL_END_DATE", diagnostics);
  var maxAttemptsRaw = belle_env_requireString_(props, "BELLE_OCR_MAX_ATTEMPTS", diagnostics);
  var backoffRaw = belle_env_requireString_(props, "BELLE_OCR_RETRY_BACKOFF_SECONDS", diagnostics);
  var exportBatchRaw = belle_env_requireString_(props, "BELLE_EXPORT_BATCH_MAX_ROWS", diagnostics);

  if (apiKey) {
    // Do not log secrets.
  }
  if (model) {
    // Model value is non-secret.
  }

  if (maxAttemptsRaw) {
    var maxAttemptsCheck = belle_env_parseIntInRange_(maxAttemptsRaw, 1, 10);
    if (!maxAttemptsCheck.ok) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_OCR_MAX_ATTEMPTS",
        maxAttemptsCheck.reason,
        "value=" + maxAttemptsRaw,
        "Set integer 1..10."
      );
    }
  }

  if (backoffRaw) {
    var backoffCheck = belle_env_parseIntInRange_(backoffRaw, 0, 86400);
    if (!backoffCheck.ok) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_OCR_RETRY_BACKOFF_SECONDS",
        backoffCheck.reason,
        "value=" + backoffRaw,
        "Set integer 0..86400."
      );
    }
  }

  if (exportBatchRaw) {
    var exportBatchCheck = belle_env_parseIntInRange_(exportBatchRaw, 1, 50000);
    if (!exportBatchCheck.ok) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_EXPORT_BATCH_MAX_ROWS",
        exportBatchCheck.reason,
        "value=" + exportBatchRaw,
        "Set integer 1..50000."
      );
    }
  }

  if (fiscalStart && fiscalEnd && typeof belle_yayoi_validateFiscalRange === "function") {
    var fiscalRes = belle_yayoi_validateFiscalRange(fiscalStart, fiscalEnd);
    if (!fiscalRes || fiscalRes.ok !== true) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_FISCAL_START_DATE",
        fiscalRes && fiscalRes.reason ? String(fiscalRes.reason) : "FISCAL_RANGE_INVALID",
        "start=" + fiscalStart + " end=" + fiscalEnd,
        "Set YYYY-MM-DD range within the same year."
      );
    }
  }

  var ss = null;
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_SHEET_ID",
        "OPEN_FAILED",
        "id=" + belle_env_maskId_(sheetId),
        "Check spreadsheet access and ID."
      );
    }
  }

  if (integrationsId) {
    try {
      SpreadsheetApp.openById(integrationsId);
    } catch (e) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_INTEGRATIONS_SHEET_ID",
        "OPEN_FAILED",
        "id=" + belle_env_maskId_(integrationsId),
        "Check integrations spreadsheet access and ID."
      );
    }
  }

  var driveFolder = null;
  if (driveFolderId) {
    try {
      driveFolder = DriveApp.getFolderById(driveFolderId);
    } catch (e) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_DRIVE_FOLDER_ID",
        "OPEN_FAILED",
        "id=" + belle_env_maskId_(driveFolderId),
        "Check Drive folder access and ID."
      );
    }
  }

  if (outputFolderId) {
    try {
      DriveApp.getFolderById(outputFolderId);
    } catch (e) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_OUTPUT_FOLDER_ID",
        "OPEN_FAILED",
        "id=" + belle_env_maskId_(outputFolderId),
        "Check output folder access and ID."
      );
    }
  }

  var logArchiveFolder = null;
  if (logArchiveId) {
    try {
      logArchiveFolder = DriveApp.getFolderById(logArchiveId);
    } catch (e) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_LOG_ARCHIVE_FOLDER_ID",
        "OPEN_FAILED",
        "id=" + belle_env_maskId_(logArchiveId),
        "Check log archive folder access and ID."
      );
    }
  }

  var imagesArchiveFolder = null;
  if (imagesArchiveId) {
    try {
      imagesArchiveFolder = DriveApp.getFolderById(imagesArchiveId);
    } catch (e) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_IMAGES_ARCHIVE_FOLDER_ID",
        "OPEN_FAILED",
        "id=" + belle_env_maskId_(imagesArchiveId),
        "Check images archive folder access and ID."
      );
    }
  }

  if (ensure && ss) {
    var queueNames = [];
    var queueSeen = {};
    var queueDocTypes = belle_ocr_getActiveDocTypes_(props);
    for (var qd = 0; qd < queueDocTypes.length; qd++) {
      var queueName = belle_ocr_getQueueSheetNameForDocType_(props, queueDocTypes[qd]);
      if (!queueName) continue;
      if (!queueSeen[queueName]) {
        queueSeen[queueName] = true;
        queueNames.push(queueName);
      }
    }
    for (var q = 0; q < queueNames.length; q++) {
      var queueRes = belle_env_ensureQueueSheet_(ss, queueNames[q], ensured);
      if (!queueRes.ok) {
        belle_env_addDiag_(
          diagnostics,
          queueNames[q],
          "SHEET_ENSURE_FAILED",
          "Queue sheet ensure failed.",
          "Check sheet header and permissions."
        );
      }
    }

    var exportLogRes = belle_env_ensureExportLogSheet_(ss, ensured);
    if (!exportLogRes.ok) {
      belle_env_addDiag_(
        diagnostics,
        "EXPORT_LOG",
        "SHEET_ENSURE_FAILED",
        exportLogRes.reason === "LEGACY_IMPORT_LOG"
          ? "IMPORT_LOG exists; rename to EXPORT_LOG."
          : "Export log ensure failed.",
        "Ensure EXPORT_LOG exists with correct header."
      );
    }

    var exportSkipHeader = belle_getSkipLogHeader_();
    var exportSkipRes = belle_env_ensureLogSheet_(ss, "EXPORT_SKIP_LOG", exportSkipHeader, ensured);
    if (!exportSkipRes.ok) {
      belle_env_addDiag_(
        diagnostics,
        "EXPORT_SKIP_LOG",
        "SHEET_ENSURE_FAILED",
        "Export skip log ensure failed.",
        "Check sheet header and permissions."
      );
    }

    var queueSkipHeader = belle_getQueueSkipLogHeader_();
    var queueSkipRes = belle_env_ensureLogSheet_(ss, "QUEUE_SKIP_LOG", queueSkipHeader, ensured);
    if (!queueSkipRes.ok) {
      belle_env_addDiag_(
        diagnostics,
        "QUEUE_SKIP_LOG",
        "SHEET_ENSURE_FAILED",
        "Queue skip log ensure failed.",
        "Check sheet header and permissions."
      );
    }

    var guardHeader = belle_getExportGuardLogHeader_();
    var guardRes = belle_env_ensureLogSheet_(ss, "EXPORT_GUARD_LOG", guardHeader, ensured);
    if (!guardRes.ok) {
      belle_env_addDiag_(
        diagnostics,
        "EXPORT_GUARD_LOG",
        "SHEET_ENSURE_FAILED",
        "Export guard log ensure failed.",
        "Check sheet header and permissions."
      );
    }
  }

  var activeSubfolders = [];
  var activeDocTypes = belle_ocr_getActiveDocTypes_(props);
  var seen = {};
  for (var d = 0; d < activeDocTypes.length; d++) {
    var spec = belle_docType_getSpec_(activeDocTypes[d]);
    var folderName = spec && spec.source_subfolder_name ? String(spec.source_subfolder_name) : "";
    if (!folderName) {
      belle_env_addDiag_(
        diagnostics,
        "DOC_TYPE_SPEC",
        "SPEC_MISSING",
        "doc_type=" + String(activeDocTypes[d] || ""),
        "Verify DocTypeRegistry definitions."
      );
      continue;
    }
    if (!seen[folderName]) {
      seen[folderName] = true;
      activeSubfolders.push(folderName);
    }
  }

  if (driveFolder) {
    for (var f = 0; f < activeSubfolders.length; f++) {
      var name = activeSubfolders[f];
      var folderRes = belle_env_getOrCreateFolder_(driveFolder, name, ensure);
      if (!folderRes.ok) {
        belle_env_addDiag_(
          diagnostics,
          "BELLE_DRIVE_FOLDER_ID",
          "SUBFOLDER_ENSURE_FAILED",
          "Missing subfolder: " + name,
          "Create subfolder \"" + name + "\" under input folder."
        );
      } else if (folderRes.created) {
        ensured.folders_created.push("input/" + name);
      }
    }
  }

  if (imagesArchiveFolder && activeSubfolders.length > 0) {
    for (var a = 0; a < activeSubfolders.length; a++) {
      var archiveName = activeSubfolders[a];
      var archiveRes = belle_env_getOrCreateFolder_(imagesArchiveFolder, archiveName, ensure);
      if (!archiveRes.ok) {
        belle_env_addDiag_(
          diagnostics,
          "BELLE_IMAGES_ARCHIVE_FOLDER_ID",
          "ARCHIVE_SUBFOLDER_ENSURE_FAILED",
          "Missing subfolder: " + archiveName,
          "Create archive subfolder \"" + archiveName + "\"."
        );
      } else if (archiveRes.created) {
        ensured.folders_created.push("images_archive/" + archiveName);
      }
    }
  }

  if (logArchiveFolder) {
    var now = new Date();
    var year = Utilities.formatDate(now, "Asia/Tokyo", "yyyy");
    var month = Utilities.formatDate(now, "Asia/Tokyo", "MM");
    var reportsRes = belle_env_getOrCreateFolder_(logArchiveFolder, "export_run_reports", ensure);
    if (!reportsRes.ok) {
      belle_env_addDiag_(
        diagnostics,
        "BELLE_LOG_ARCHIVE_FOLDER_ID",
        "ARCHIVE_SUBFOLDER_ENSURE_FAILED",
        "Missing export_run_reports folder.",
        "Create export_run_reports under log archive folder."
      );
    } else if (reportsRes.created) {
      ensured.folders_created.push("log_archive/export_run_reports");
    }

    if (reportsRes.ok) {
      var yearRes = belle_env_getOrCreateFolder_(reportsRes.folder, year, ensure);
      if (!yearRes.ok) {
        belle_env_addDiag_(
          diagnostics,
          "BELLE_LOG_ARCHIVE_FOLDER_ID",
          "ARCHIVE_SUBFOLDER_ENSURE_FAILED",
          "Missing year folder: " + year,
          "Create year folder under export_run_reports."
        );
      } else if (yearRes.created) {
        ensured.folders_created.push("log_archive/export_run_reports/" + year);
      }

      if (yearRes.ok) {
        var monthRes = belle_env_getOrCreateFolder_(yearRes.folder, month, ensure);
        if (!monthRes.ok) {
          belle_env_addDiag_(
            diagnostics,
            "BELLE_LOG_ARCHIVE_FOLDER_ID",
            "ARCHIVE_SUBFOLDER_ENSURE_FAILED",
            "Missing month folder: " + month,
            "Create month folder under export_run_reports/" + year + "."
          );
        } else if (monthRes.created) {
          ensured.folders_created.push("log_archive/export_run_reports/" + year + "/" + month);
        }
      }
    }
  }

  var ready = diagnostics.length === 0;
  return {
    ok: true,
    reason: ready ? "READY" : "NOT_READY",
    message: ready ? "Environment ready." : "Environment not ready.",
    data: {
      ready: ready,
      diagnostics: diagnostics,
      ensured: ensured
    }
  };
}
