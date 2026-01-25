// NOTE: Keep comments ASCII only.

function belle_getQueueHeaderColumns_v0() {
  return [
    "status",
    "file_id",
    "file_name",
    "mime_type",
    "drive_url",
    "queued_at_iso",
    "doc_type",
    "source_subfolder",
    "ocr_json",
    "ocr_error",
    "ocr_attempts",
    "ocr_last_attempt_at_iso",
    "ocr_next_retry_at_iso",
    "ocr_error_code",
    "ocr_error_detail"
  ];
}

function belle_getQueueLockHeaderColumns_v0_() {
  return ["ocr_lock_owner", "ocr_lock_until_iso", "ocr_processing_started_at_iso"];
}

function belle_queue_buildRow_(header, data) {
  const row = new Array(header.length);
  for (let i = 0; i < header.length; i++) {
    const key = header[i];
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      row[i] = data[key];
    } else {
      row[i] = "";
    }
  }
  return row;
}

function belle_queue_filterNewFiles_(files, existingSet) {
  const out = [];
  const seen = existingSet || new Set();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || !f.id) continue;
    const id = String(f.id);
    if (seen.has(id)) continue;
    out.push(f);
  }
  return out;
}

function belle_queue_loadExistingFileIds_(sh, headerMap) {
  const existing = new Set();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return existing;
  const idx = headerMap["file_id"];
  if (idx === undefined) return existing;
  const vals = sh.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i][0];
    if (v) existing.add(String(v));
  }
  return existing;
}

/**
 * Append-only queue writer (doc_type routing by subfolder).
 */
function belle_queueFolderFilesToSheetInternal_() {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrThrow_(props);

  const listed = belle_listFilesInFolder();
  const filesByDocType = listed.filesByDocType || {};
  const skipped = listed.skipped || [];
  const activeDocTypes = belle_ocr_getActiveDocTypes_(props);

  const ss = SpreadsheetApp.openById(sheetId);
  const baseHeader = belle_getQueueHeaderColumns_v0();
  const extraHeader = belle_getQueueLockHeaderColumns_v0_();
  const nowIso = new Date().toISOString();
  const queuedByDocType = {};
  let queuedTotal = 0;

  for (let i = 0; i < activeDocTypes.length; i++) {
    const docType = activeDocTypes[i];
    const sheetName = belle_ocr_getQueueSheetNameForDocType_(props, docType);
    if (!sheetName) continue;
    let sh = ss.getSheetByName(sheetName);
    if (!sh) sh = ss.insertSheet(sheetName);
    const headerMap = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader);
    if (!headerMap) throw new Error("INVALID_QUEUE_HEADER: " + sheetName);
    const existing = belle_queue_loadExistingFileIds_(sh, headerMap);
    const files = belle_queue_filterNewFiles_(filesByDocType[docType] || [], existing);
    const rows = [];
    for (let j = 0; j < files.length; j++) {
      const f = files[j];
      const row = belle_queue_buildRow_(baseHeader, {
        status: "QUEUED",
        file_id: String(f.id),
        file_name: String(f.name || ""),
        mime_type: String(f.mimeType || ""),
        drive_url: String(f.url || ""),
        queued_at_iso: nowIso,
        doc_type: docType,
        source_subfolder: String(f.source_subfolder || ""),
        ocr_json: "",
        ocr_error: "",
        ocr_attempts: "",
        ocr_last_attempt_at_iso: "",
        ocr_next_retry_at_iso: "",
        ocr_error_code: "",
        ocr_error_detail: ""
      });
      rows.push(row);
    }
    if (rows.length > 0) {
      const startRow = sh.getLastRow() + 1;
      sh.getRange(startRow, 1, rows.length, baseHeader.length).setValues(rows);
    }
    queuedByDocType[docType] = rows.length;
    queuedTotal += rows.length;
  }

  if (skipped.length > 0) {
    belle_appendQueueSkipLogRows_(ss, skipped, nowIso, props);
  }

  const result = {
    ok: true,
    queued: queuedTotal,
    queuedByDocType: queuedByDocType,
    totalListed: listed.files ? listed.files.length : 0,
    skipped: skipped.length
  };
  Logger.log(result);
  return result;
}

function belle_queue_getStatusCounts() {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrEmpty_(props);
  if (!sheetId) return { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };

  const counts = { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };
  const ss = SpreadsheetApp.openById(sheetId);
  const queueNames = belle_ocr_getActiveDocTypes_(props);
  const baseHeader = belle_getQueueHeaderColumns_v0();
  const extraHeader = belle_getQueueLockHeaderColumns_v0_();

  for (let i = 0; i < queueNames.length; i++) {
    const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, queueNames[i]);
    const sh = ss.getSheetByName(queueSheetName);
    if (!sh) continue;

    const headerMap = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader);
    if (!headerMap) continue;

    const lastRow = sh.getLastRow();
    if (lastRow < 2) continue;

    const rows = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const status = String(row[headerMap["status"]] || "");
      const normalized = status || "QUEUED";
      counts.totalCount++;
      if (normalized === "DONE") counts.doneCount++;
      else if (normalized === "ERROR_FINAL") counts.errorFinalCount++;
      else if (normalized === "ERROR_RETRYABLE" || normalized === "ERROR") counts.errorRetryableCount++;
      else counts.queuedRemaining++;
    }
  }
  return counts;
}
