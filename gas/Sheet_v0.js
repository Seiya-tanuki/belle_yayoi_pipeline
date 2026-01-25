// NOTE: Keep comments ASCII only.

function belle_sheet_appendRowsInChunks_(sh, rows, chunkSize) {
  if (!rows || rows.length === 0) return 0;
  const sizeRaw = Number(chunkSize);
  const size = sizeRaw && isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : 200;
  let written = 0;
  let startRow = sh.getLastRow() + 1;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const width = chunk[0] ? chunk[0].length : 0;
    if (!width) continue;
    sh.getRange(startRow, 1, chunk.length, width).setValues(chunk);
    startRow += chunk.length;
    written += chunk.length;
  }
  return written;
}

function belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader, opts) {
  const required = baseHeader.concat(extraHeader || []);
  const options = opts || {};
  const appendMissing = options.appendMissing !== false;
  const throwOnMissing = options.throwOnMissing === true;
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(required);
  }

  let headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (appendMissing) {
    let nextCol = headerRow.length + 1;
    for (let i = 0; i < required.length; i++) {
      if (headerRow.indexOf(required[i]) === -1) {
        sh.getRange(1, nextCol).setValue(required[i]);
        nextCol++;
      }
    }
  }

  headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    map[String(headerRow[i] || "")] = i;
  }

  for (let i = 0; i < baseHeader.length; i++) {
    if (map[baseHeader[i]] === undefined) {
      if (throwOnMissing) throw new Error("INVALID_QUEUE_HEADER: missing required columns");
      return null;
    }
  }
  return map;
}

// @deprecated (CLN-0015) Use belle_queue_ensureHeaderMapCanonical_ instead.
function belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader, opts) {
  return belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader, opts);
}

// @deprecated (CLN-0015) Use belle_queue_ensureHeaderMapCanonical_ instead.
function belle_queue_ensureHeaderMapForExport(sh, baseHeader, extraHeader, opts) {
  return belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader, opts);
}

function belle_exportLog_buildHeaderMap_(sheet, requiredHeader) {
  const lastCol = sheet.getLastColumn();
  const expected = Array.isArray(requiredHeader) ? requiredHeader : [];
  if (lastCol < 1) {
    return { ok: false, headerMap: {}, actualHeader: [], missing: expected.slice() };
  }
  const raw = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const headerMap = {};
  const actual = [];
  for (let i = 0; i < raw.length; i++) {
    const name = String(raw[i] || "");
    actual.push(name);
    headerMap[name] = i;
  }
  const missing = [];
  for (let i = 0; i < expected.length; i++) {
    if (headerMap[expected[i]] === undefined) missing.push(expected[i]);
  }
  return { ok: missing.length === 0, headerMap: headerMap, actualHeader: actual, missing: missing };
}

function belle_exportLog_computeWidth_(headerMap) {
  let maxIdx = -1;
  const keys = Object.keys(headerMap || {});
  for (let i = 0; i < keys.length; i++) {
    const idx = Number(headerMap[keys[i]]);
    if (!isNaN(idx) && idx > maxIdx) maxIdx = idx;
  }
  return maxIdx >= 0 ? maxIdx + 1 : 0;
}

function belle_exportLog_buildRow_(headerMap, width, fileId, nowIso, csvFileId) {
  if (!headerMap || !width) return [fileId, nowIso, csvFileId];
  const row = new Array(width).fill("");
  if (headerMap.file_id !== undefined) row[headerMap.file_id] = fileId;
  if (headerMap.exported_at_iso !== undefined) row[headerMap.exported_at_iso] = nowIso;
  if (headerMap.csv_file_id !== undefined) row[headerMap.csv_file_id] = csvFileId;
  return row;
}

function belle_export_flushExportLog_(exportLog, fileIds, nowIso, csvFileId, chunkSize, headerMap) {
  if (!exportLog || !fileIds || fileIds.length === 0) return 0;
  const sizeRaw = Number(chunkSize);
  const size = sizeRaw && isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : 200;
  const width = headerMap ? belle_exportLog_computeWidth_(headerMap) : 0;
  let written = 0;
  let buffer = [];
  for (let i = 0; i < fileIds.length; i++) {
    buffer.push(belle_exportLog_buildRow_(headerMap, width, fileIds[i], nowIso, csvFileId));
    if (buffer.length >= size) {
      written += belle_sheet_appendRowsInChunks_(exportLog, buffer, size);
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    written += belle_sheet_appendRowsInChunks_(exportLog, buffer, size);
  }
  return written;
}


function belle_resetSpreadsheetToInitialState_fallback_v0Internal_() {
  const EXPECTED_RESET_TOKEN = "RESET_FALLBACK_V0_CONFIRM";
  const props = belle_cfg_getProps_();
  const token = String(props.getProperty("BELLE_RESET_TOKEN") || "");
  if (token !== EXPECTED_RESET_TOKEN) {
    const guard = { phase: "RESET_GUARD", ok: true, reason: "RESET_TOKEN_MISMATCH" };
    Logger.log(guard);
    return guard;
  }

  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
  } catch (e) {
    const guard = { phase: "RESET_GUARD", ok: true, reason: "LOCK_BUSY" };
    Logger.log(guard);
    return guard;
  }

  try {
    const sheetId = belle_cfg_getSheetIdOrEmpty_(props);
    if (!sheetId) {
      const guard = { phase: "RESET_GUARD", ok: true, reason: "MISSING_SHEET_ID" };
      Logger.log(guard);
      return guard;
    }

    const ss = SpreadsheetApp.openById(sheetId);
    const receiptSheetName = belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_RECEIPT);
    const docDefs = belle_getDocTypeDefs_();
    const queueNames = [];
    for (let i = 0; i < docDefs.length; i++) {
      const name = belle_ocr_getQueueSheetNameForDocType_(props, docDefs[i].docType);
      if (queueNames.indexOf(name) < 0) queueNames.push(name);
    }
    const exportLogName = "EXPORT_LOG";
    const candidates = [
      receiptSheetName
    ];
    for (let i = 0; i < queueNames.length; i++) {
      candidates.push(queueNames[i]);
    }
    candidates.push(
      exportLogName,
      "QUEUE",
      "IMPORT_LOG",
      "REVIEW_UI",
      "REVIEW_STATE",
      "REVIEW_LOG"
    );
    const uniq = {};
    const targets = [];
    for (let i = 0; i < candidates.length; i++) {
      const name = candidates[i];
      if (name && !uniq[name]) {
        uniq[name] = true;
        targets.push(name);
      }
    }

    const existing = [];
    for (let i = 0; i < targets.length; i++) {
      const sh = ss.getSheetByName(targets[i]);
      if (sh) existing.push(sh);
    }

    let temp = null;
    if (existing.length > 0 && existing.length >= ss.getSheets().length) {
      temp = ss.insertSheet("__RESET_TMP__");
    }

    const deleted = [];
    for (let i = 0; i < existing.length; i++) {
      const sh = existing[i];
      deleted.push(sh.getName());
      ss.deleteSheet(sh);
    }

    const queueHeader = belle_getQueueHeaderColumns_v0();
    const createdSheets = [];
    for (let i = 0; i < queueNames.length; i++) {
      const name = queueNames[i];
      const queueSheet = ss.insertSheet(name);
      queueSheet.getRange(1, 1, 1, queueHeader.length).setValues([queueHeader]);
      createdSheets.push(name);
    }

    const exportLogSheet = ss.insertSheet(exportLogName);
    const exportHeader = belle_getExportLogHeaderColumns_v0();
    exportLogSheet.getRange(1, 1, 1, exportHeader.length).setValues([exportHeader]);

    if (temp) ss.deleteSheet(temp);

    const result = {
      phase: "RESET_DONE",
      ok: true,
      deletedSheets: deleted,
      createdSheets: createdSheets.concat([exportLogName]),
      tokenCleared: true
    };
    props.deleteProperty("BELLE_RESET_TOKEN");
    Logger.log(result);
    return result;
  } finally {
    if (lock) lock.releaseLock();
  }
}