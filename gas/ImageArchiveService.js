// @ts-check

// NOTE: Keep comments ASCII only.

function belle_image_archive_getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function belle_image_archive_collectDoneFileIds_(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { ok: true, fileIds: [], missing: true };
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, fileIds: [], missing: false };
  var lastCol = sh.getLastColumn();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var h = 0; h < header.length; h++) {
    map[String(header[h] || "")] = h;
  }
  if (map.status === undefined || map.file_id === undefined) {
    return { ok: false, reason: "INVALID_QUEUE_HEADER", message: "Missing required columns.", sheet: sheetName };
  }
  var rowCount = lastRow - 1;
  var statusVals = sh.getRange(2, map.status + 1, rowCount, 1).getValues();
  var fileVals = sh.getRange(2, map.file_id + 1, rowCount, 1).getValues();
  var out = [];
  var seen = {};
  for (var i = 0; i < rowCount; i++) {
    var status = String(statusVals[i][0] || "");
    if (status !== "DONE") continue;
    var fileId = String(fileVals[i][0] || "");
    if (!fileId || seen[fileId]) continue;
    seen[fileId] = true;
    out.push(fileId);
  }
  return { ok: true, fileIds: out, missing: false };
}

function belle_image_archive_run_() {
  var props = belle_cfg_getProps_();
  var sheetId = belle_cfg_getSheetIdOrEmpty_(props);
  if (!sheetId) {
    return { ok: false, reason: "MISSING_SHEET_ID", message: "Missing BELLE_SHEET_ID.", data: null };
  }
  var rootId = String(props.getProperty("BELLE_IMAGES_ARCHIVE_FOLDER_ID") || "").trim();
  if (!rootId) {
    return { ok: false, reason: "IMAGES_ARCHIVE_FOLDER_ID_MISSING", message: "Missing BELLE_IMAGES_ARCHIVE_FOLDER_ID.", data: null };
  }

  var root;
  try {
    root = DriveApp.getFolderById(rootId);
  } catch (e) {
    return { ok: false, reason: "IMAGES_ARCHIVE_FOLDER_OPEN_FAILED", message: "Archive folder open failed.", data: null };
  }

  var ss = SpreadsheetApp.openById(sheetId);
  var docTypes = [
    { key: BELLE_DOC_TYPE_RECEIPT, folder: "receipt" },
    { key: BELLE_DOC_TYPE_CC_STATEMENT, folder: "cc_statement" },
    { key: BELLE_DOC_TYPE_BANK_STATEMENT, folder: "bank_statement" }
  ];
  var movedByDocType = {};
  var failedByDocType = {};
  var failures = [];

  for (var i = 0; i < docTypes.length; i++) {
    var docType = docTypes[i];
    var sheetName = belle_ocr_getQueueSheetNameForDocType_(props, docType.key);
    var collected = belle_image_archive_collectDoneFileIds_(ss, sheetName);
    if (!collected.ok) {
      return { ok: false, reason: collected.reason || "QUEUE_READ_FAILED", message: collected.message || "Queue read failed.", data: { sheet: collected.sheet } };
    }
    var folder = belle_image_archive_getOrCreateFolder_(root, docType.folder);
    var moved = 0;
    var failed = 0;
    var ids = collected.fileIds || [];
    for (var j = 0; j < ids.length; j++) {
      var fileId = ids[j];
      try {
        var file = DriveApp.getFileById(fileId);
        file.moveTo(folder);
        moved++;
      } catch (e) {
        failed++;
        if (failures.length < 10) failures.push({ file_id: fileId, doc_type: docType.key });
      }
    }
    movedByDocType[docType.key] = moved;
    failedByDocType[docType.key] = failed;
  }

  var totalFailed = 0;
  var keys = Object.keys(failedByDocType);
  for (var k = 0; k < keys.length; k++) {
    totalFailed += Number(failedByDocType[keys[k]] || 0);
  }
  if (totalFailed > 0) {
    return {
      ok: false,
      reason: "FILE_MOVE_FAILED",
      message: "Some files failed to move.",
      data: {
        moved: movedByDocType,
        failed: failedByDocType,
        failures: failures
      }
    };
  }

  return {
    ok: true,
    reason: "OK",
    message: "Images archived.",
    data: {
      moved: movedByDocType,
      failed: failedByDocType
    }
  };
}
