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


function belle_getQueueHeader_fallback_v0_() {
  return belle_getQueueHeaderColumns_v0().concat(belle_getQueueLockHeaderColumns_v0_());
}

function belle_ocr_resolveClaimScanMax_(value, totalRows) {
  const n = Number(value || "");
  if (isNaN(n) || n <= 0) return totalRows;
  return Math.min(Math.floor(n), totalRows);
}

function belle_ocr_buildClaimScanPlan_(totalRows, cursorValue, maxScanRows) {
  const total = Math.max(0, Number(totalRows) || 0);
  if (total === 0) return { indices: [], nextCursor: 0 };
  const maxScan = belle_ocr_resolveClaimScanMax_(maxScanRows, total);
  let cursor = Number(cursorValue || 0);
  if (isNaN(cursor) || cursor < 0 || cursor >= total) cursor = 0;
  const indices = [];
  for (let i = 0; i < maxScan; i++) {
    indices.push((cursor + i) % total);
  }
  const nextCursor = (cursor + maxScan) % total;
  return { indices: indices, nextCursor: nextCursor };
}

function belle_ocr_buildClaimCursorKey_(docType) {
  const key = String(docType || "").trim();
  if (!key) return "BELLE_OCR_CLAIM_CURSOR__receipt";
  return "BELLE_OCR_CLAIM_CURSOR__" + key;
}

function belle_ocr_buildStaleRecovery_(row, headerMap, nowMs) {
  const status = String(row[headerMap["status"]] || "");
  if (status !== "PROCESSING") return null;
  const lockUntil = String(row[headerMap["ocr_lock_until_iso"]] || "");
  if (lockUntil) {
    const t = Date.parse(lockUntil);
    if (!isNaN(t) && t > nowMs) return null;
  }
  const owner = String(row[headerMap["ocr_lock_owner"]] || "");
  const started = String(row[headerMap["ocr_processing_started_at_iso"]] || "");
  const detail = {
    previous_owner: owner,
    lock_until_iso: lockUntil,
    processing_started_at_iso: started
  };
  return {
    statusOut: "ERROR_RETRYABLE",
    errorCode: "WORKER_STALE_LOCK",
    errorMessage: "WORKER_STALE_LOCK",
    errorDetail: JSON.stringify(detail),
    nextRetryIso: "",
    clearLocks: true
  };
}

function belle_ocr_claimNextRow_fallback_v0_(opts) {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrThrow_(props);
  const docType = opts && opts.docType ? String(opts.docType) : BELLE_DOC_TYPE_RECEIPT;
  const queueSheetName = opts && opts.queueSheetName
    ? String(opts.queueSheetName)
    : belle_ocr_getQueueSheetNameForDocType_(props, docType);
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const workerId = opts && opts.workerId ? String(opts.workerId) : Utilities.getUuid();
  const ttlSeconds = Number((opts && opts.ttlSeconds) || "180");
  let lock;
  try {
    lock = LockService.getScriptLock();
    const lockMode = opts && opts.lockMode ? String(opts.lockMode) : "wait";
    const waitMs = Number((opts && opts.lockWaitMs) || "30000");
    if (lockMode === "try") {
      if (!lock.tryLock(waitMs)) {
        const res = { phase: "OCR_CLAIM", ok: true, claimed: false, reason: "LOCK_BUSY" };
        Logger.log(res);
        return res;
      }
    } else {
      lock.waitLock(waitMs);
    }
  } catch (e) {
    const res = { phase: "OCR_CLAIM", ok: true, claimed: false, reason: "LOCK_BUSY" };
    Logger.log(res);
    return res;
  }

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sh = ss.getSheetByName(queueSheetName);
    if (!sh) throw new Error("Sheet not found: " + queueSheetName);

    const baseHeader = belle_getQueueHeaderColumns_v0();
    const extraHeader = belle_getQueueLockHeaderColumns_v0_();
    const headerMap = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader);
    if (!headerMap) {
      const res = { phase: "OCR_CLAIM", ok: true, claimed: false, reason: "INVALID_QUEUE_HEADER" };
      Logger.log(res);
      return res;
    }

    const lastRow = sh.getLastRow();
    if (lastRow < 2) {
      const res = { phase: "OCR_CLAIM", ok: true, claimed: false, reason: "NO_ROWS", processingCount: 0 };
      Logger.log(res);
      return res;
    }

    const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    let processingCount = 0;
    for (let i = 0; i < values.length; i++) {
      const status = String(values[i][headerMap["status"]] || "");
      if (status === "PROCESSING") processingCount++;
    }
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const scanMaxRaw = props.getProperty("BELLE_OCR_CLAIM_SCAN_MAX_ROWS");
    const cursorKey = belle_ocr_buildClaimCursorKey_(docType);
    const cursorRaw = belle_cfg_getOcrClaimCursorRaw_(props, docType, cursorKey);
    const scanPlan = belle_ocr_buildClaimScanPlan_(values.length, cursorRaw, scanMaxRaw);
    const scanIndices = scanPlan.indices;
    props.setProperty(cursorKey, String(scanPlan.nextCursor));

    const staleFixed = [];
    for (let s = 0; s < scanIndices.length; s++) {
      const i = scanIndices[s];
      const row = values[i];
      const fileId = String(row[headerMap["file_id"]] || "");
      if (!fileId) continue;
      const recovery = belle_ocr_buildStaleRecovery_(row, headerMap, nowMs);
      if (!recovery) continue;
      const sheetRow = i + 2;
      const detail = String(recovery.errorDetail || "").slice(0, 500);
      sh.getRange(sheetRow, headerMap["status"] + 1).setValue(recovery.statusOut);
      sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue(String(recovery.errorMessage || ""));
      sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue(String(recovery.errorCode || ""));
      sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue(detail);
      sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
      if (recovery.clearLocks) {
        sh.getRange(sheetRow, headerMap["ocr_lock_owner"] + 1).setValue("");
        sh.getRange(sheetRow, headerMap["ocr_lock_until_iso"] + 1).setValue("");
        sh.getRange(sheetRow, headerMap["ocr_processing_started_at_iso"] + 1).setValue("");
      }
      row[headerMap["status"]] = recovery.statusOut;
      row[headerMap["ocr_error"]] = String(recovery.errorMessage || "");
      row[headerMap["ocr_error_code"]] = String(recovery.errorCode || "");
      row[headerMap["ocr_error_detail"]] = detail;
      row[headerMap["ocr_next_retry_at_iso"]] = "";
      if (recovery.clearLocks) {
        row[headerMap["ocr_lock_owner"]] = "";
        row[headerMap["ocr_lock_until_iso"]] = "";
        row[headerMap["ocr_processing_started_at_iso"]] = "";
      }
      staleFixed.push(fileId);
    }
    if (staleFixed.length > 0) {
      Logger.log({ phase: "OCR_REAP_STALE", fixed: staleFixed.length, sampleFileIds: staleFixed.slice(0, 5) });
    }

    function claimAt(index, statusBefore) {
      const row = values[index];
      const fileId = String(row[headerMap["file_id"]] || "");
      const fileName = String(row[headerMap["file_name"]] || "");
      const sheetRow = index + 2;
      const lockUntilIso = new Date(nowMs + ttlSeconds * 1000).toISOString();
      sh.getRange(sheetRow, headerMap["status"] + 1).setValue("PROCESSING");
      sh.getRange(sheetRow, headerMap["ocr_lock_owner"] + 1).setValue(workerId);
      sh.getRange(sheetRow, headerMap["ocr_lock_until_iso"] + 1).setValue(lockUntilIso);
      sh.getRange(sheetRow, headerMap["ocr_processing_started_at_iso"] + 1).setValue(nowIso);
      const res = {
        phase: "OCR_CLAIM",
        ok: true,
        claimed: true,
        rowIndex: sheetRow,
        file_id: fileId,
        file_name: fileName,
        statusBefore: statusBefore,
        workerId: workerId,
        lockUntilIso: lockUntilIso,
        docType: docType,
        queueSheetName: queueSheetName,
        processingCount: processingCount
      };
      Logger.log(res);
      return res;
    }

    for (let s = 0; s < scanIndices.length; s++) {
      const i = scanIndices[s];
      const row = values[i];
      const status = String(row[headerMap["status"]] || "");
      const normalized = status || "QUEUED";
      const fileId = String(row[headerMap["file_id"]] || "");
      if (!fileId) continue;
      if (normalized === "DONE" || normalized === "ERROR_FINAL") continue;
      if (normalized === "QUEUED") {
        return claimAt(i, normalized);
      }
    }

    for (let s = 0; s < scanIndices.length; s++) {
      const i = scanIndices[s];
      const row = values[i];
      const status = String(row[headerMap["status"]] || "");
      const normalized = status || "QUEUED";
      const fileId = String(row[headerMap["file_id"]] || "");
      if (!fileId) continue;
      if (normalized === "DONE" || normalized === "ERROR_FINAL") continue;
      if (normalized === "ERROR_RETRYABLE" || normalized === "ERROR") {
        const nextRetryAt = String(row[headerMap["ocr_next_retry_at_iso"]] || "");
        if (!nextRetryAt) return claimAt(i, normalized);
        const t = Date.parse(nextRetryAt);
        if (isNaN(t) || t <= nowMs) return claimAt(i, normalized);
      }
    }

    const res = { phase: "OCR_CLAIM", ok: true, claimed: false, reason: "NO_TARGET", processingCount: processingCount };
    Logger.log(res);
    return res;
  } finally {
    if (lock) lock.releaseLock();
  }
}

function belle_ocr_claimNextRowByDocTypes_(opts) {
  const props = belle_cfg_getProps_();
  const docTypes = opts && Array.isArray(opts.docTypes) && opts.docTypes.length > 0
    ? opts.docTypes
    : belle_ocr_getActiveDocTypes_(props);
  let last = null;
  for (let i = 0; i < docTypes.length; i++) {
    const docType = docTypes[i];
    const res = belle_ocr_claimNextRow_fallback_v0_({
      workerId: opts && opts.workerId ? opts.workerId : undefined,
      ttlSeconds: opts && opts.ttlSeconds !== undefined ? opts.ttlSeconds : undefined,
      lockMode: opts && opts.lockMode ? opts.lockMode : undefined,
      lockWaitMs: opts && opts.lockWaitMs !== undefined ? opts.lockWaitMs : undefined,
      docType: docType
    });
    last = res;
    if (res && res.claimed === true) return res;
    const reason = res && res.reason ? String(res.reason) : "";
    if (reason && reason !== "NO_TARGET" && reason !== "NO_ROWS") return res;
  }
  return last || { phase: "OCR_CLAIM", ok: true, claimed: false, reason: "NO_TARGET" };
}

function belle_processQueueOnceInternal_(options) {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrThrow_(props);

  const useLock = !(options && options.skipLock === true);
  const lock = useLock ? LockService.getScriptLock() : null;
  if (useLock) lock.waitLock(30000);

  try {
    const docTypes = belle_ocr_getActiveDocTypes_(props);
    let last = null;
    for (let i = 0; i < docTypes.length; i++) {
      const docType = docTypes[i];
      const res = belle_processQueueOnceForDocType_(props, docType, options);
      last = res;
      if (res && res.processed > 0) return res;
      if (res && res.reason && res.reason !== "NO_TARGET") return res;
    }
    return last || { ok: true, processed: 0, reason: "NO_TARGET", errorsCount: 0 };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function belle_processQueueOnceForDocType_(props, docType, options) {
  const sheetId = belle_cfg_getSheetIdOrThrow_(props);
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, docType);
  const maxAttempts = Number(props.getProperty("BELLE_OCR_MAX_ATTEMPTS") || "3");
  const backoffSeconds = Number(props.getProperty("BELLE_OCR_RETRY_BACKOFF_SECONDS") || "300");
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const cfg = belle_getGeminiConfig();
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) throw new Error("Sheet not found: " + queueSheetName);

  const baseHeader = belle_getQueueHeaderColumns_v0();
  const extraHeader = belle_getQueueLockHeaderColumns_v0_();
  const lastRow = sh.getLastRow();
  if (lastRow < 1) {
    return { ok: false, processed: 0, reason: "QUEUE_EMPTY: sheet has no header", errorsCount: 0, docType: docType, queueSheetName: queueSheetName };
  }

  const headerMap = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader);
  if (!headerMap) {
    return { ok: false, processed: 0, reason: "INVALID_QUEUE_HEADER: missing required columns", errorsCount: 0, docType: docType, queueSheetName: queueSheetName };
  }

  if (lastRow < 2) {
    return { ok: false, processed: 0, reason: "QUEUE_EMPTY: run belle_queueFolderFilesToSheet first", errorsCount: 0, docType: docType, queueSheetName: queueSheetName };
  }

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  let processed = 0;
  let scanned = 0;
  const processedRows = [];
  let errorsCount = 0;

  const legacyFixed = [];
  const nowIso = new Date().toISOString();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const status = String(row[headerMap["status"]] || "");
    const fileId = String(row[headerMap["file_id"]] || "");
    const ocrJson = String(row[headerMap["ocr_json"]] || "");
    const ocrError = String(row[headerMap["ocr_error"]] || "");
    const normalized = status || "QUEUED";
    if (!fileId) continue;
    if ((normalized === "ERROR_RETRYABLE" || normalized === "ERROR") && ocrJson && !ocrError) {
      const sheetRow = i + 2;
      const detail = String(ocrJson).slice(0, 500);
      const summary = detail.slice(0, 200);
      sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue("LEGACY_ERROR_IN_OCR_JSON");
      sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue(detail);
      sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue(summary);
      sh.getRange(sheetRow, headerMap["ocr_json"] + 1).setValue("");
      const attempt = Number(row[headerMap["ocr_attempts"]] || 0) || 1;
      const lastAttempt = String(row[headerMap["ocr_last_attempt_at_iso"]] || "");
      const nextRetry = String(row[headerMap["ocr_next_retry_at_iso"]] || "");
      if (!row[headerMap["ocr_attempts"]]) {
        sh.getRange(sheetRow, headerMap["ocr_attempts"] + 1).setValue(attempt);
      }
      if (!lastAttempt) {
        sh.getRange(sheetRow, headerMap["ocr_last_attempt_at_iso"] + 1).setValue(nowIso);
      }
      if (!nextRetry) {
        const backoff = Math.max(1, backoffSeconds) * 1000 * Math.min(attempt, 6);
        const nextRetryIso = new Date(Date.now() + backoff).toISOString();
        sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue(nextRetryIso);
      }
      values[i][headerMap["ocr_json"]] = "";
      legacyFixed.push(fileId);
    }
  }
  if (legacyFixed.length > 0) {
    Logger.log({ phase: "OCR_LEGACY_NORMALIZE", fixed: legacyFixed.length, sampleFileIds: legacyFixed.slice(0, 5), docType: docType });
  }

  const queuedIdx = [];
  const retryIdx = [];
  const nowMs = Date.now();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const status = String(row[headerMap["status"]] || "");
    const fileId = String(row[headerMap["file_id"]] || "");
    const nextRetryAt = String(row[headerMap["ocr_next_retry_at_iso"]] || "");
    if (!fileId) continue;
    const normalized = status || "QUEUED";
    if (normalized === "QUEUED") {
      queuedIdx.push(i);
      continue;
    }
    if (normalized === "ERROR_RETRYABLE" || normalized === "ERROR") {
      if (!nextRetryAt) {
        retryIdx.push(i);
      } else {
        const t = Date.parse(nextRetryAt);
        if (isNaN(t) || t <= nowMs) retryIdx.push(i);
      }
    }
  }

  const targets = queuedIdx.concat(retryIdx);
  for (let t = 0; t < targets.length; t++) {
    if (processed >= cfg.maxItems) break;
    const i = targets[t];
    scanned++;

    const row = values[i];
    const status = String(row[headerMap["status"]] || "");
    const fileId = String(row[headerMap["file_id"]] || "");
    const fileName = String(row[headerMap["file_name"]] || "");
    const mimeType = String(row[headerMap["mime_type"]] || "");
    const ocrJson = String(row[headerMap["ocr_json"]] || "");
    const ocrErr = String(row[headerMap["ocr_error"]] || "");
    const ocrErrCode = String(row[headerMap["ocr_error_code"]] || "");
    const ocrErrDetail = String(row[headerMap["ocr_error_detail"]] || "");
    const nextRetryAt = String(row[headerMap["ocr_next_retry_at_iso"]] || "");
    const rowDocType = String(row[headerMap["doc_type"]] || docType || "");

    if (!fileId) continue;
    const normalized = status || "QUEUED";
    if (normalized === "DONE") continue;
    if (ocrJson && normalized !== "ERROR_RETRYABLE" && normalized !== "ERROR") continue;

    const sheetRow = i + 2;
    const attempt = Number(row[headerMap["ocr_attempts"]] || 0) + 1;
    const attemptIso = new Date().toISOString();
    sh.getRange(sheetRow, headerMap["ocr_attempts"] + 1).setValue(attempt);
    sh.getRange(sheetRow, headerMap["ocr_last_attempt_at_iso"] + 1).setValue(attemptIso);
    Logger.log({
      phase: "OCR_ITEM_START",
      row: sheetRow,
      file_id: fileId,
      file_name: fileName,
      attempts: attempt,
      status: status || "QUEUED",
      isRetryableTarget: t >= queuedIdx.length,
      nowIso: new Date(nowMs).toISOString(),
      nextRetryIso: nextRetryAt,
      doc_type: rowDocType
    });

    let jsonStr = "";
    try {
      if (mimeType === "application/pdf") {
        sh.getRange(sheetRow, headerMap["status"] + 1).setValue("ERROR_FINAL");
        sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue("PDF not supported in v0");
        sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue("UNSUPPORTED_PDF");
        sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue("PDF not supported in v0");
        sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
        Logger.log({ phase: "OCR_ITEM_DONE", row: sheetRow, file_id: fileId, status: "ERROR_FINAL", doc_type: rowDocType });
        processedRows.push(sheetRow);
        processed++;
        errorsCount++;
        continue;
      }

        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        jsonStr = belle_callGeminiOcr(blob);
      const MAX_CELL_CHARS = 45000;
      if (jsonStr.length > MAX_CELL_CHARS) {
        throw new Error("OCR JSON too long for single cell: " + jsonStr.length);
      }
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error("INVALID_SCHEMA: PARSE_ERROR");
      }
      const validation = belle_ocr_validateSchema(parsed);
      if (!validation.ok) {
        throw new Error("INVALID_SCHEMA: " + validation.reason);
      }
      sh.getRange(sheetRow, headerMap["ocr_json"] + 1).setValue(jsonStr);
      sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue("");
      sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue("");
      sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue("");
      sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
      sh.getRange(sheetRow, headerMap["status"] + 1).setValue("DONE");
      Logger.log({ phase: "OCR_ITEM_DONE", row: sheetRow, file_id: fileId, status: "DONE", doc_type: rowDocType });
      processedRows.push(sheetRow);
      processed++;

      if (cfg.sleepMs > 0) Utilities.sleep(cfg.sleepMs);
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      let detail = msg.slice(0, 500);
      const classify = belle_ocr_classifyError(msg);
      const retryable = classify.retryable === true;
      let statusOut = retryable ? "ERROR_RETRYABLE" : "ERROR_FINAL";
      let errorCode = classify.code;
      if (retryable && attempt >= maxAttempts) {
        statusOut = "ERROR_FINAL";
        errorCode = "MAX_ATTEMPTS_EXCEEDED";
      }
      if (errorCode === "INVALID_SCHEMA" && jsonStr) {
        detail = belle_ocr_buildInvalidSchemaLogDetail_(jsonStr);
      }
      sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue(msg.slice(0, 200));
      sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue(errorCode);
      sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue(detail);
      sh.getRange(sheetRow, headerMap["status"] + 1).setValue(statusOut);
      sh.getRange(sheetRow, headerMap["ocr_json"] + 1).setValue("");
      if (statusOut === "ERROR_RETRYABLE") {
        const backoff = Math.max(1, backoffSeconds) * 1000 * Math.min(attempt, 6);
        const nextRetryIso = new Date(Date.now() + backoff).toISOString();
        sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue(nextRetryIso);
      } else {
        sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
      }
      Logger.log({
        phase: "OCR_ITEM_ERROR",
        row: sheetRow,
        file_id: fileId,
        file_name: fileName,
        error_code: errorCode,
        message: msg.slice(0, 200),
        doc_type: rowDocType
      });
      processedRows.push(sheetRow);
      processed++;
      errorsCount++;
    }
  }

  const result = {
    ok: true,
    processed: processed,
    scanned: scanned,
    maxItems: cfg.maxItems,
    processedRows: processedRows,
    errorsCount: errorsCount,
    docType: docType,
    queueSheetName: queueSheetName
  };
  Logger.log(result);
  return result;
}
