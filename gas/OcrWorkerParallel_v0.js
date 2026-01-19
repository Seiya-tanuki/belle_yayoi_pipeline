// @ts-check

// NOTE: Keep comments ASCII only.

function belle_ocr_worker_resolveTtlSeconds_(value) {
  const n = Number(value || "");
  if (isNaN(n) || n <= 0) return 300;
  return n;
}

function belle_ocr_worker_resolveMaxItems_(value) {
  const n = Number(value || "");
  if (isNaN(n) || n <= 0) return 1;
  return n;
}

function belle_ocr_worker_calcBackoffMs_(attempt, backoffSeconds) {
  const base = Math.max(1, Number(backoffSeconds) || 1) * 1000;
  return base * Math.min(Number(attempt) || 0, 6);
}

function belle_ocr_workerOnce_fallback_v0_(opts) {
  const props = PropertiesService.getScriptProperties();
  const workerId = opts && opts.workerId ? String(opts.workerId) : Utilities.getUuid();
  const ttlSeconds = belle_ocr_worker_resolveTtlSeconds_(props.getProperty("BELLE_OCR_LOCK_TTL_SECONDS"));
  const claim = belle_ocr_claimNextRow_fallback_v0_({ workerId: workerId, ttlSeconds: ttlSeconds });
  if (!claim || claim.claimed !== true) {
    return { ok: true, processed: 0, reason: claim && claim.reason ? claim.reason : "NO_TARGET" };
  }

  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const queueSheetName = belle_getQueueSheetName(props);
  const maxAttempts = Number(props.getProperty("BELLE_OCR_MAX_ATTEMPTS") || "3");
  const backoffSeconds = Number(props.getProperty("BELLE_OCR_RETRY_BACKOFF_SECONDS") || "300");
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) throw new Error("Sheet not found: " + queueSheetName);

  const headerAll = belle_getQueueHeader_fallback_v0_();
  const baseHeader = headerAll.slice(0, 8);
  const extraHeader = headerAll.slice(8);
  const headerMap = belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader);
  if (!headerMap) {
    return { ok: false, processed: 0, reason: "INVALID_QUEUE_HEADER" };
  }

  const rowIndex = claim.rowIndex;
  const row = sh.getRange(rowIndex, 1, 1, sh.getLastColumn()).getValues()[0];
  const fileId = String(row[headerMap["file_id"]] || "");
  const fileName = String(row[headerMap["file_name"]] || "");
  const mimeType = String(row[headerMap["mime_type"]] || "");
  const status = String(row[headerMap["status"]] || "");
  const statusBefore = claim.statusBefore || status;
  const ocrJson = String(row[headerMap["ocr_json"]] || "");
  const ocrError = String(row[headerMap["ocr_error"]] || "");
  const attemptsPrev = Number(row[headerMap["ocr_attempts"]] || 0) || 0;

  let attempt = attemptsPrev;
  const attemptIso = new Date().toISOString();
  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const rowNow = sh.getRange(rowIndex, 1, 1, sh.getLastColumn()).getValues()[0];
    const ownerNow = String(rowNow[headerMap["ocr_lock_owner"]] || "");
    const statusNow = String(rowNow[headerMap["status"]] || "");
    if (ownerNow !== workerId || statusNow !== "PROCESSING") {
      const res = { ok: true, processed: 0, reason: "CLAIM_LOST", file_id: fileId, rowIndex: rowIndex };
      Logger.log({ phase: "OCR_WORKER_ITEM", workerId: workerId, outcome: "CLAIM_LOST", file_id: fileId, rowIndex: rowIndex });
      return res;
    }

    if ((statusBefore === "ERROR_RETRYABLE" || statusBefore === "ERROR") && ocrJson && !ocrError) {
      const detail = String(ocrJson).slice(0, 500);
      const summary = detail.slice(0, 200);
      sh.getRange(rowIndex, headerMap["ocr_error_code"] + 1).setValue("LEGACY_ERROR_IN_OCR_JSON");
      sh.getRange(rowIndex, headerMap["ocr_error_detail"] + 1).setValue(detail);
      sh.getRange(rowIndex, headerMap["ocr_error"] + 1).setValue(summary);
      sh.getRange(rowIndex, headerMap["ocr_json"] + 1).setValue("");
    }

    attempt = attemptsPrev + 1;
    sh.getRange(rowIndex, headerMap["ocr_attempts"] + 1).setValue(attempt);
    sh.getRange(rowIndex, headerMap["ocr_last_attempt_at_iso"] + 1).setValue(attemptIso);
  } finally {
    if (lock) lock.releaseLock();
  }

  let outcome = "";
  let jsonStr = "";
  let errorCode = "";
  let errorDetail = "";
  let errorMessage = "";
  let nextRetryIso = "";
  let statusOut = "";

  try {
    if (mimeType === "application/pdf") {
      outcome = "ERROR_FINAL";
      statusOut = "ERROR_FINAL";
      errorCode = "UNSUPPORTED_PDF";
      errorMessage = "PDF not supported in v0";
      errorDetail = "PDF not supported in v0";
    } else {
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
      outcome = "DONE";
      statusOut = "DONE";
    }
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const detail = msg.slice(0, 500);
    const classify = belle_ocr_classifyError(msg);
    const retryable = classify.retryable === true;
    statusOut = retryable ? "ERROR_RETRYABLE" : "ERROR_FINAL";
    errorCode = classify.code;
    if (retryable && attempt >= maxAttempts) {
      statusOut = "ERROR_FINAL";
      errorCode = "MAX_ATTEMPTS_EXCEEDED";
    }
    errorMessage = msg.slice(0, 200);
    errorDetail = detail;
    if (statusOut === "ERROR_RETRYABLE") {
      const backoff = belle_ocr_worker_calcBackoffMs_(attempt, backoffSeconds);
      nextRetryIso = new Date(Date.now() + backoff).toISOString();
    }
    outcome = statusOut;
  }

  lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const rowNow = sh.getRange(rowIndex, 1, 1, sh.getLastColumn()).getValues()[0];
    const ownerNow = String(rowNow[headerMap["ocr_lock_owner"]] || "");
    const statusNow = String(rowNow[headerMap["status"]] || "");
    if (ownerNow !== workerId || statusNow !== "PROCESSING") {
      const res = { ok: true, processed: 0, reason: "CLAIM_LOST", file_id: fileId, rowIndex: rowIndex };
      Logger.log({ phase: "OCR_WORKER_ITEM", workerId: workerId, outcome: "CLAIM_LOST", file_id: fileId, rowIndex: rowIndex });
      return res;
    }

    sh.getRange(rowIndex, headerMap["ocr_lock_owner"] + 1).setValue("");
    sh.getRange(rowIndex, headerMap["ocr_lock_until_iso"] + 1).setValue("");
    sh.getRange(rowIndex, headerMap["ocr_processing_started_at_iso"] + 1).setValue("");

    if (statusOut === "DONE") {
      sh.getRange(rowIndex, headerMap["ocr_json"] + 1).setValue(jsonStr);
      sh.getRange(rowIndex, headerMap["ocr_error"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["ocr_error_code"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["ocr_error_detail"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["status"] + 1).setValue("DONE");
    } else {
      sh.getRange(rowIndex, headerMap["ocr_error"] + 1).setValue(errorMessage);
      sh.getRange(rowIndex, headerMap["ocr_error_code"] + 1).setValue(errorCode);
      sh.getRange(rowIndex, headerMap["ocr_error_detail"] + 1).setValue(errorDetail);
      sh.getRange(rowIndex, headerMap["ocr_json"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["ocr_next_retry_at_iso"] + 1).setValue(nextRetryIso);
      sh.getRange(rowIndex, headerMap["status"] + 1).setValue(statusOut);
    }
  } finally {
    if (lock) lock.releaseLock();
  }

  Logger.log({
    phase: "OCR_WORKER_ITEM",
    file_id: fileId,
    rowIndex: rowIndex,
    outcome: outcome,
    attempt: attempt,
    workerId: workerId
  });

  return { ok: true, processed: 1, outcome: outcome, file_id: fileId, rowIndex: rowIndex };
}

function belle_ocr_workerLoop_fallback_v0_(opts) {
  const props = PropertiesService.getScriptProperties();
  const maxItems = belle_ocr_worker_resolveMaxItems_(props.getProperty("BELLE_OCR_WORKER_MAX_ITEMS"));
  const workerId = opts && opts.workerId ? String(opts.workerId) : Utilities.getUuid();
  const summary = { phase: "OCR_WORKER_SUMMARY", ok: true, processed: 0, done: 0, errors: 0, workerId: workerId };
  for (let i = 0; i < maxItems; i++) {
    const r = belle_ocr_workerOnce_fallback_v0_({ workerId: workerId });
    if (!r || r.processed === 0) break;
    summary.processed++;
    if (r.outcome === "DONE") summary.done++;
    else summary.errors++;
  }
  Logger.log(summary);
  return summary;
}

function belle_ocr_workerLoop_fallback_v0_test() {
  const res = belle_ocr_workerLoop_fallback_v0_({ workerId: Utilities.getUuid() });
  Logger.log(res);
  return res;
}
