// @ts-check

// NOTE: Keep comments ASCII only.

function belle_ocr_perf_ensureLogSheet_(ss) {
  const header = belle_perf_getHeaderV2_();
  const ensured = belle_log_ensureSheetWithHeader_(ss, "PERF_LOG", header);
  return ensured.sheet;
}

function belle_ocr_perf_appendFromSummary_(summary) {
  if (!summary) return false;
  const props = belle_cfg_getProps_();
  const integrationsSheetId = props.getProperty("BELLE_INTEGRATIONS_SHEET_ID");
  if (!integrationsSheetId) return false;

  const row = belle_perf_buildRowV2_(summary);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.openById(integrationsSheetId);
    const sheet = belle_ocr_perf_ensureLogSheet_(ss);
    belle_sheet_appendRowsInChunks_(sheet, [row], 200);
  } finally {
    lock.releaseLock();
  }
  return true;
}

function belle_ocr_workerOnce_fallback_v0_(opts) {
  const totalStart = Date.now();
  const props = belle_cfg_getProps_();
  const workerId = opts && opts.workerId ? String(opts.workerId) : Utilities.getUuid();
  let processingCount = 0;
  const docTypes = opts && Array.isArray(opts.docTypes) && opts.docTypes.length > 0
    ? opts.docTypes
    : belle_ocr_getActiveDocTypes_(props);
  const ttlSeconds = belle_ocr_worker_resolveTtlSeconds_(props.getProperty("BELLE_OCR_LOCK_TTL_SECONDS"));
  const lockMode = opts && opts.lockMode ? String(opts.lockMode) : "wait";
  const lockWaitMs = Number((opts && opts.lockWaitMs) || "30000");
  const claimStart = Date.now();
  const claim = belle_ocr_claimNextRowByDocTypes_({
    workerId: workerId,
    ttlSeconds: ttlSeconds,
    lockMode: lockMode,
    lockWaitMs: lockWaitMs,
    docTypes: docTypes
  });
  if (claim && claim.processingCount !== undefined) {
    processingCount = Number(claim.processingCount) || 0;
  }
  const claimElapsedMs = Date.now() - claimStart;
  if (!claim || claim.claimed !== true) {
    return {
      ok: true,
      processed: 0,
      reason: claim && claim.reason ? claim.reason : "NO_TARGET",
      claimElapsedMs: claimElapsedMs,
      totalItemElapsedMs: Date.now() - totalStart,
      geminiElapsedMs: 0,
      classify: "",
      httpStatus: 0,
      processingCount: processingCount
    };
  }

  const sheetId = belle_cfg_getSheetIdOrThrow_(props);
  const queueSheetName = claim.queueSheetName || belle_getQueueSheetName(props);
  const maxAttempts = Number(props.getProperty("BELLE_OCR_MAX_ATTEMPTS") || "3");
  const backoffSeconds = Number(props.getProperty("BELLE_OCR_RETRY_BACKOFF_SECONDS") || "300");
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) throw new Error("Sheet not found: " + queueSheetName);

  const baseHeader = belle_getQueueHeaderColumns_v0();
  const extraHeader = belle_getQueueLockHeaderColumns_v0_();
  const headerMap = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader);
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
  const rowDocType = headerMap["doc_type"] !== undefined ? String(row[headerMap["doc_type"]] || "") : "";
  const docType = rowDocType || claim.docType || "";
  const docSpec = belle_docType_getSpec_(docType);
  const pipelineKind = docSpec ? docSpec.pipeline_kind : "";
  const isTwoStage = pipelineKind === BELLE_DOC_PIPELINE_TWO_STAGE;
  const ocrJsonBefore = String(row[headerMap["ocr_json"]] || "");
  const ocrError = String(row[headerMap["ocr_error"]] || "");
  const ocrErrorCode = String(row[headerMap["ocr_error_code"]] || "");
  const ocrErrorDetail = String(row[headerMap["ocr_error_detail"]] || "");
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
      const totalNow = Date.now() - totalStart;
      const res = {
        ok: true,
        processed: 0,
        reason: "CLAIM_LOST",
        file_id: fileId,
        rowIndex: rowIndex,
        claimElapsedMs: claimElapsedMs,
        statusBefore: statusBefore,
        totalItemElapsedMs: totalNow,
        geminiElapsedMs: 0,
        classify: "",
        httpStatus: 0,
        docType: docType,
        queueSheetName: queueSheetName,
        processingCount: processingCount
      };
      Logger.log({ phase: "OCR_WORKER_ITEM", workerId: workerId, outcome: "CLAIM_LOST", file_id: fileId, rowIndex: rowIndex, docType: docType });
      return res;
    }

    if ((statusBefore === "ERROR_RETRYABLE" || statusBefore === "ERROR") && ocrJsonBefore && !ocrError) {
      const detail = String(ocrJsonBefore).slice(0, 500);
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
  let geminiElapsedMs = 0;
  let geminiStartMs = 0;
  let httpStatus = 0;
  let classify = "";
  let totalItemElapsedMs = 0;
  let ccStage = "";
  let ccCacheHit = false;
  let ccGeminiMs = 0;
  let ccStage2Attempted = false;
  let keepOcrJsonOnError = false;

  try {
      if (isTwoStage) {
        const ccResult = belle_ocr_cc_runOnce_({
          props: props,
          fileId: fileId,
          attempt: attempt,
          maxAttempts: maxAttempts,
          statusBefore: statusBefore,
          prevErrorCode: ocrErrorCode,
          prevError: ocrError,
          prevErrorDetail: ocrErrorDetail,
          ocrJsonBefore: ocrJsonBefore,
          backoffSeconds: backoffSeconds
        });
        ccStage = ccResult.ccStage;
        ccCacheHit = ccResult.ccCacheHit;
        ccStage2Attempted = ccResult.ccStage2Attempted;
        geminiElapsedMs = ccResult.geminiElapsedMs;
        ccGeminiMs = ccResult.ccGeminiMs;
        httpStatus = ccResult.httpStatus;
        jsonStr = ccResult.jsonStr;
        statusOut = ccResult.statusOut;
        outcome = ccResult.outcome;
        errorCode = ccResult.errorCode;
        errorMessage = ccResult.errorMessage;
        errorDetail = ccResult.errorDetail;
        nextRetryIso = ccResult.nextRetryIso;
        keepOcrJsonOnError = ccResult.keepOcrJsonOnError === true;
        if (ccResult.throwError) {
          throw new Error(ccResult.throwError);
        }
      } else {
        const receiptResult = belle_ocr_receipt_runOnce_({
          props: props,
          fileId: fileId,
          mimeType: mimeType,
          docType: docType,
          attempt: attempt,
          maxAttempts: maxAttempts,
          statusBefore: statusBefore,
          prevErrorCode: ocrErrorCode,
          prevError: ocrError,
          prevErrorDetail: ocrErrorDetail
        });
        geminiElapsedMs = receiptResult.geminiElapsedMs;
        httpStatus = receiptResult.httpStatus;
        jsonStr = receiptResult.jsonStr;
        statusOut = receiptResult.statusOut;
        outcome = receiptResult.outcome;
        errorCode = receiptResult.errorCode;
        errorMessage = receiptResult.errorMessage;
        errorDetail = receiptResult.errorDetail;
        nextRetryIso = receiptResult.nextRetryIso;
        keepOcrJsonOnError = receiptResult.keepOcrJsonOnError === true;
        if (receiptResult.throwError) {
          throw new Error(receiptResult.throwError);
        }
      }
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (geminiStartMs > 0 && geminiElapsedMs === 0) {
      geminiElapsedMs = Date.now() - geminiStartMs;
    }
    if (isTwoStage && ccGeminiMs === 0 && geminiElapsedMs > 0) {
      ccGeminiMs = geminiElapsedMs;
    }
    let detail = msg.slice(0, 500);
    const classified = belle_ocr_classifyError(msg);
    const retryable = classified.retryable === true;
    statusOut = retryable ? "ERROR_RETRYABLE" : "ERROR_FINAL";
    errorCode = classified.code;
    if (retryable && attempt >= maxAttempts) {
      statusOut = "ERROR_FINAL";
      errorCode = "MAX_ATTEMPTS_EXCEEDED";
    }
    httpStatus = belle_ocr_extractHttpStatus_(msg);
    errorMessage = msg.slice(0, 200);
    if (errorCode === "INVALID_SCHEMA" && jsonStr) {
      detail = belle_ocr_buildInvalidSchemaLogDetail_(jsonStr);
    }
    errorDetail = detail;
    if (isTwoStage && ccStage2Attempted) {
      keepOcrJsonOnError = true;
    }
    if (statusOut === "ERROR_RETRYABLE") {
      const backoff = belle_ocr_worker_calcBackoffMs_(attempt, backoffSeconds);
      nextRetryIso = new Date(Date.now() + backoff).toISOString();
    }
    outcome = statusOut;
  }

  if (!classify) {
    if (statusOut === "DONE") classify = "DONE";
    else if (errorCode === "INVALID_SCHEMA") classify = "INVALID_SCHEMA";
    else classify = statusOut || "";
  }

  lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const rowNow = sh.getRange(rowIndex, 1, 1, sh.getLastColumn()).getValues()[0];
    const ownerNow = String(rowNow[headerMap["ocr_lock_owner"]] || "");
    const statusNow = String(rowNow[headerMap["status"]] || "");
    if (ownerNow !== workerId || statusNow !== "PROCESSING") {
      const totalNow = Date.now() - totalStart;
      const res = {
        ok: true,
        processed: 0,
        reason: "CLAIM_LOST",
        file_id: fileId,
        rowIndex: rowIndex,
        claimElapsedMs: claimElapsedMs,
        statusBefore: statusBefore,
        totalItemElapsedMs: totalNow,
        geminiElapsedMs: geminiElapsedMs,
        classify: classify,
        httpStatus: httpStatus,
        docType: docType,
        queueSheetName: queueSheetName,
        processingCount: processingCount
      };
      Logger.log({ phase: "OCR_WORKER_ITEM", workerId: workerId, outcome: "CLAIM_LOST", file_id: fileId, rowIndex: rowIndex, docType: docType });
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
    } else if (statusOut === "QUEUED") {
      sh.getRange(rowIndex, headerMap["ocr_json"] + 1).setValue(jsonStr);
      sh.getRange(rowIndex, headerMap["ocr_error"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["ocr_error_code"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["ocr_error_detail"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
      sh.getRange(rowIndex, headerMap["status"] + 1).setValue("QUEUED");
    } else {
      sh.getRange(rowIndex, headerMap["ocr_error"] + 1).setValue(errorMessage);
      sh.getRange(rowIndex, headerMap["ocr_error_code"] + 1).setValue(errorCode);
      sh.getRange(rowIndex, headerMap["ocr_error_detail"] + 1).setValue(errorDetail);
      if (!keepOcrJsonOnError) {
        sh.getRange(rowIndex, headerMap["ocr_json"] + 1).setValue("");
      }
      sh.getRange(rowIndex, headerMap["ocr_next_retry_at_iso"] + 1).setValue(nextRetryIso);
      sh.getRange(rowIndex, headerMap["status"] + 1).setValue(statusOut);
    }
  } finally {
    if (lock) lock.releaseLock();
  }

  totalItemElapsedMs = Date.now() - totalStart;
  Logger.log({
    phase: "OCR_WORKER_ITEM",
    file_id: fileId,
    rowIndex: rowIndex,
    outcome: outcome,
    attempt: attempt,
    workerId: workerId,
    geminiElapsedMs: geminiElapsedMs,
    totalItemElapsedMs: totalItemElapsedMs,
    classify: classify,
    httpStatus: httpStatus,
    docType: docType,
    queueSheetName: queueSheetName,
    ccStage: ccStage,
    ccCacheHit: ccCacheHit,
    ccGeminiMs: ccGeminiMs,
    ccHttpStatus: httpStatus,
    ccErrorCode: errorCode,
    processingCount: processingCount
  });

  return {
    ok: true,
    processed: 1,
    outcome: outcome,
    file_id: fileId,
    rowIndex: rowIndex,
    claimElapsedMs: claimElapsedMs,
    statusBefore: statusBefore,
    geminiElapsedMs: geminiElapsedMs,
    totalItemElapsedMs: totalItemElapsedMs,
    classify: classify,
    httpStatus: httpStatus,
    docType: docType,
    queueSheetName: queueSheetName,
    ccStage: ccStage,
    ccCacheHit: ccCacheHit,
    ccGeminiMs: ccGeminiMs,
    ccHttpStatus: httpStatus,
    ccErrorCode: errorCode,
    processingCount: processingCount
  };
}

function belle_ocr_workerLoop_fallback_v0_(opts) {
  const props = belle_cfg_getProps_();
  const maxItemsValue = opts && opts.maxItems !== undefined ? opts.maxItems : props.getProperty("BELLE_OCR_WORKER_MAX_ITEMS");
  const maxItems = belle_ocr_worker_resolveMaxItems_(maxItemsValue);
  const workerId = opts && opts.workerId ? String(opts.workerId) : Utilities.getUuid();
  const docTypes = opts && Array.isArray(opts.docTypes) && opts.docTypes.length > 0
    ? opts.docTypes
    : belle_ocr_getActiveDocTypes_(props);
  const lockMode = opts && opts.lockMode ? String(opts.lockMode) : "wait";
  const lockWaitMs = Number((opts && opts.lockWaitMs) || "30000");
  const summary = {
    phase: "OCR_WORKER_SUMMARY",
    ok: true,
    processed: 0,
    done: 0,
    stage1Cached: 0,
    errors: 0,
    retryable: 0,
    final: 0,
    workerId: workerId,
    claimedRowIndex: null,
    claimedFileId: "",
    claimedStatusBefore: "",
    claimedDocType: "",
    claimElapsedMs: 0,
    lastReason: "",
    lockBusySkipped: 0,
    geminiElapsedMs: 0,
    totalItemElapsedMs: 0,
    avgGeminiMs: 0,
    p95GeminiMs: 0,
    avgTotalItemMs: 0,
    p95TotalItemMs: 0,
    classify: "",
    httpStatus: 0,
    docType: "",
    queueSheetName: "",
    docTypes: docTypes.slice(),
    ccStage: "",
    ccCacheHit: false,
    ccGeminiMs: 0,
    ccHttpStatus: 0,
    ccErrorCode: "",
    processingCount: 0
  };
  const geminiSamples = [];
  const totalSamples = [];
  for (let i = 0; i < maxItems; i++) {
    const r = belle_ocr_workerOnce_fallback_v0_({ workerId: workerId, lockMode: lockMode, lockWaitMs: lockWaitMs, docTypes: docTypes });
    if (!r || r.processed === 0) {
      summary.lastReason = r && r.reason ? r.reason : "NO_TARGET";
      if (summary.lastReason === "LOCK_BUSY") summary.lockBusySkipped = 1;
      break;
    }
    summary.processed++;
    if (r.outcome === "DONE") summary.done++;
    else if (r.outcome === "STAGE1_CACHED") summary.stage1Cached++;
    else {
      summary.errors++;
      if (r.outcome === "ERROR_RETRYABLE") summary.retryable++;
      if (r.outcome === "ERROR_FINAL") summary.final++;
    }
    if (typeof r.geminiElapsedMs === "number") geminiSamples.push(r.geminiElapsedMs);
    if (typeof r.totalItemElapsedMs === "number") totalSamples.push(r.totalItemElapsedMs);
    if (summary.claimedRowIndex === null && r.rowIndex) {
      summary.claimedRowIndex = r.rowIndex;
      summary.claimedFileId = r.file_id || "";
      summary.claimedStatusBefore = r.statusBefore || "";
      summary.claimedDocType = r.docType || "";
      summary.claimElapsedMs = r.claimElapsedMs || 0;
    }
    summary.classify = r.classify || r.outcome || "";
    summary.httpStatus = r.httpStatus || 0;
    if (typeof r.processingCount === "number") summary.processingCount = r.processingCount;
    if (!summary.docType && r.docType) {
      summary.docType = r.docType;
      summary.queueSheetName = r.queueSheetName || "";
    }
    const rSpec = belle_docType_getSpec_(r.docType || "");
    const rKind = rSpec ? rSpec.pipeline_kind : "";
    if (rKind === BELLE_DOC_PIPELINE_TWO_STAGE) {
      summary.ccStage = r.ccStage || "";
      summary.ccCacheHit = r.ccCacheHit === true;
      summary.ccGeminiMs = typeof r.ccGeminiMs === "number" ? r.ccGeminiMs : 0;
      summary.ccHttpStatus = r.ccHttpStatus || r.httpStatus || 0;
      summary.ccErrorCode = r.ccErrorCode || "";
    }
    if (belle_ocr_shouldStopAfterItem_(r.docType)) break;
  }
  if (geminiSamples.length > 0) {
    const sorted = geminiSamples.slice().sort(function (a, b) { return a - b; });
    const sum = geminiSamples.reduce(function (a, b) { return a + b; }, 0);
    summary.avgGeminiMs = Math.round(sum / geminiSamples.length);
    summary.p95GeminiMs = sorted[Math.floor((sorted.length - 1) * 0.95)];
    summary.geminiElapsedMs = summary.avgGeminiMs;
  }
  if (totalSamples.length > 0) {
    const sorted = totalSamples.slice().sort(function (a, b) { return a - b; });
    const sum = totalSamples.reduce(function (a, b) { return a + b; }, 0);
    summary.avgTotalItemMs = Math.round(sum / totalSamples.length);
    summary.p95TotalItemMs = sorted[Math.floor((sorted.length - 1) * 0.95)];
    summary.totalItemElapsedMs = summary.avgTotalItemMs;
  }
  Logger.log(summary);
  return summary;
}
