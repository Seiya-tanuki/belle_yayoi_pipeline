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

function belle_ocr_extractHttpStatus_(message) {
  const msg = String(message || "");
  const m = msg.match(/Gemini HTTP\s+(\d{3})/i);
  if (m) return Number(m[1]);
  return 0;
}

function belle_ocr_perf_truncate_(text, maxLen) {
  const s = String(text || "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...(truncated)";
}

function belle_ocr_perf_ensureLogSheet_(ss) {
  const name = "PERF_LOG";
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const header = [
    "ts_iso",
    "phase",
    "worker_id",
    "processed",
    "done",
    "retryable",
    "final",
    "lock_busy",
    "avg_gemini_ms",
    "p95_gemini_ms",
    "avg_total_ms",
    "detail"
  ];
  const current = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  const mismatch = header.some(function (h, i) {
    return String(current[i] || "") !== h;
  });
  if (mismatch) {
    sheet.clear();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sheet;
}

function belle_ocr_perf_appendFromSummary_(summary) {
  if (!summary) return false;
  const props = PropertiesService.getScriptProperties();
  const integrationsSheetId = props.getProperty("BELLE_INTEGRATIONS_SHEET_ID");
  if (!integrationsSheetId) return false;

  let detail = "";
  try {
    detail = JSON.stringify(summary);
  } catch (e) {
    detail = String(summary);
  }
  detail = belle_ocr_perf_truncate_(detail, 2000);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.openById(integrationsSheetId);
    const sheet = belle_ocr_perf_ensureLogSheet_(ss);
    sheet.appendRow([
      new Date().toISOString(),
      String(summary.phase || "OCR_WORKER_SUMMARY"),
      String(summary.workerId || ""),
      Number(summary.processed || 0),
      Number(summary.done || 0),
      Number(summary.retryable || 0),
      Number(summary.final || 0),
      Number(summary.lockBusySkipped || 0),
      Number(summary.avgGeminiMs || 0),
      Number(summary.p95GeminiMs || 0),
      Number(summary.avgTotalItemMs || 0),
      detail
    ]);
  } finally {
    lock.releaseLock();
  }
  return true;
}

function belle_ocr_workerOnce_fallback_v0_(opts) {
  const totalStart = Date.now();
  const props = PropertiesService.getScriptProperties();
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

  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const queueSheetName = claim.queueSheetName || belle_getQueueSheetName(props);
  const maxAttempts = Number(props.getProperty("BELLE_OCR_MAX_ATTEMPTS") || "3");
  const backoffSeconds = Number(props.getProperty("BELLE_OCR_RETRY_BACKOFF_SECONDS") || "300");
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) throw new Error("Sheet not found: " + queueSheetName);

  const baseHeader = belle_getQueueHeaderColumns_v0();
  const extraHeader = belle_getQueueLockHeaderColumns_v0_();
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
  const rowDocType = headerMap["doc_type"] !== undefined ? String(row[headerMap["doc_type"]] || "") : "";
  const docType = rowDocType || claim.docType || "";
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
    if (mimeType === "application/pdf" && !belle_ocr_allowPdfForDocType_(docType)) {
      outcome = "ERROR_FINAL";
      statusOut = "ERROR_FINAL";
      errorCode = "UNSUPPORTED_PDF";
      errorMessage = "PDF not supported in v0";
      errorDetail = "PDF not supported in v0";
    } else if (docType === "cc_statement") {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const tempInfo = belle_ocr_computeGeminiTemperature_({
        attempt: attempt,
        maxAttempts: maxAttempts,
        statusBefore: statusBefore,
        prevErrorCode: ocrErrorCode,
        prevError: ocrError,
        prevErrorDetail: ocrErrorDetail
      });
      if (tempInfo.overridden) {
        Logger.log({
          phase: "GEMINI_TEMPERATURE_POLICY",
          temperature: tempInfo.temperature,
          defaultTemp: tempInfo.defaultTemp,
          addTemp: tempInfo.addTemp,
          attempt: attempt,
          maxAttempts: maxAttempts,
          statusBefore: statusBefore,
          prevErrorCode: ocrErrorCode
        });
      }

      const cacheInfo = belle_ocr_cc_detectStageFromCache_(ocrJsonBefore);
      ccStage = cacheInfo.stage;
      ccCacheHit = ccStage === "stage2";

      if (cacheInfo.cacheInvalid) {
        errorCode = "CC_STAGE1_CACHE_INVALID";
        errorMessage = "cc_statement stage1 cache invalid";
        errorDetail = belle_ocr_buildInvalidSchemaLogDetail_(ocrJsonBefore);
      }

      if (ccStage === "stage1") {
        const stage1Prompt = belle_ocr_getCcStage1Prompt_();
        const stage1Options = {
          temperature: tempInfo.temperature,
          promptText: stage1Prompt,
          generationConfig: belle_ocr_cc_getStage1GenCfg_(props)
        };
        if (belle_ocr_cc_enableResponseMimeType_(props)) stage1Options.responseMimeType = "application/json";
        if (belle_ocr_cc_enableResponseJsonSchema_(props)) stage1Options.responseJsonSchema = belle_ocr_cc_getStage1ResponseJsonSchema_();

        geminiStartMs = Date.now();
        const stage1JsonStr = belle_callGeminiOcr(blob, stage1Options);
        geminiElapsedMs = Date.now() - geminiStartMs;
        ccGeminiMs = geminiElapsedMs;
        httpStatus = 200;
        jsonStr = stage1JsonStr;
        let stage1Parsed;
        try {
          stage1Parsed = JSON.parse(stage1JsonStr);
        } catch (e) {
          throw new Error("INVALID_SCHEMA: CC_STAGE1_PARSE_ERROR");
        }
        const stage1Validation = belle_ocr_validateCcStage1_(stage1Parsed);
        if (!stage1Validation.ok) {
          throw new Error("INVALID_SCHEMA: " + stage1Validation.reason);
        }
        const stage1Writeback = belle_ocr_cc_buildStage1Writeback_(stage1Parsed.page_type, stage1JsonStr);
        statusOut = stage1Writeback.statusOut;
        outcome = statusOut === "QUEUED" ? "STAGE1_CACHED" : statusOut;
        errorCode = stage1Writeback.errorCode;
        errorMessage = stage1Writeback.errorMessage;
        errorDetail = stage1Writeback.errorDetail;
        if (statusOut === "ERROR_RETRYABLE") {
          const backoff = belle_ocr_worker_calcBackoffMs_(attempt, backoffSeconds);
          nextRetryIso = new Date(Date.now() + backoff).toISOString();
        }
        if (statusOut === "QUEUED") {
          jsonStr = stage1Writeback.cacheJson;
        }
      } else {
        ccStage2Attempted = true;
        const stage2Prompt = belle_ocr_getCcStage2Prompt_();
        const stage2Options = {
          temperature: tempInfo.temperature,
          promptText: stage2Prompt,
          generationConfig: belle_ocr_cc_getStage2GenCfg_(props)
        };
        if (belle_ocr_cc_enableResponseMimeType_(props)) stage2Options.responseMimeType = "application/json";
        if (belle_ocr_cc_enableResponseJsonSchema_(props)) stage2Options.responseJsonSchema = belle_ocr_cc_getStage2ResponseJsonSchema_();

        geminiStartMs = Date.now();
        const stage2JsonStr = belle_callGeminiOcr(blob, stage2Options);
        geminiElapsedMs = Date.now() - geminiStartMs;
        ccGeminiMs = geminiElapsedMs;
        httpStatus = 200;
        jsonStr = stage2JsonStr;
        const MAX_CELL_CHARS = 45000;
        if (jsonStr.length > MAX_CELL_CHARS) {
          throw new Error("OCR JSON too long for single cell: " + jsonStr.length);
        }
        let parsed;
        try {
          parsed = JSON.parse(stage2JsonStr);
        } catch (e) {
          throw new Error("INVALID_SCHEMA: PARSE_ERROR");
        }
        const transactions = parsed && parsed.transactions;
        if (!Array.isArray(transactions) || transactions.length === 0) {
          const noRows = belle_ocr_cc_buildStage2NoRowsWriteback_(stage2JsonStr);
          statusOut = noRows.statusOut;
          outcome = statusOut;
          errorCode = noRows.errorCode;
          errorMessage = noRows.errorMessage.slice(0, 200);
          errorDetail = noRows.errorDetail;
          keepOcrJsonOnError = true;
          const backoff = belle_ocr_worker_calcBackoffMs_(attempt, backoffSeconds);
          nextRetryIso = new Date(Date.now() + backoff).toISOString();
        } else {
          const validation = belle_ocr_validateCcStage2_(parsed);
          if (!validation.ok) {
            throw new Error("INVALID_SCHEMA: " + validation.reason);
          }
          const stage2Writeback = belle_ocr_cc_buildStage2SuccessWriteback_(stage2JsonStr);
          statusOut = stage2Writeback.statusOut;
          outcome = "DONE";
          jsonStr = stage2Writeback.nextJson;
          errorCode = "";
          errorMessage = "";
          errorDetail = "";
        }
      }
    } else {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const tempInfo = belle_ocr_computeGeminiTemperature_({
        attempt: attempt,
        maxAttempts: maxAttempts,
        statusBefore: statusBefore,
        prevErrorCode: ocrErrorCode,
        prevError: ocrError,
        prevErrorDetail: ocrErrorDetail
      });
      if (tempInfo.overridden) {
        Logger.log({
          phase: "GEMINI_TEMPERATURE_POLICY",
          temperature: tempInfo.temperature,
          defaultTemp: tempInfo.defaultTemp,
          addTemp: tempInfo.addTemp,
          attempt: attempt,
          maxAttempts: maxAttempts,
          statusBefore: statusBefore,
          prevErrorCode: ocrErrorCode
        });
      }
      geminiStartMs = Date.now();
      jsonStr = belle_callGeminiOcr(blob, { temperature: tempInfo.temperature });
      geminiElapsedMs = Date.now() - geminiStartMs;
      httpStatus = 200;
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
    if (geminiStartMs > 0 && geminiElapsedMs === 0) {
      geminiElapsedMs = Date.now() - geminiStartMs;
    }
    if (docType === "cc_statement" && ccGeminiMs === 0 && geminiElapsedMs > 0) {
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
    if (docType === "cc_statement" && ccStage2Attempted) {
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
  const props = PropertiesService.getScriptProperties();
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
    if (r.docType === "cc_statement") {
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

function belle_ocr_workerLoop_fallback_v0_test() {
  const res = belle_ocr_workerLoop_fallback_v0_({ workerId: Utilities.getUuid() });
  Logger.log(res);
  return res;
}

function belle_ocr_parallel_smoke_test() {
  const workerId1 = Utilities.getUuid();
  const workerId2 = Utilities.getUuid();
  const r1 = belle_ocr_workerLoop_fallback_v0_({ workerId: workerId1, maxItems: 1 });
  Utilities.sleep(200);
  const r2 = belle_ocr_workerLoop_fallback_v0_({ workerId: workerId2, maxItems: 1 });
  const sameClaim = r1 && r2 && r1.claimedFileId && r1.claimedFileId === r2.claimedFileId;
  const res = {
    phase: "OCR_PARALLEL_SMOKE",
    worker1: { claimedFileId: r1.claimedFileId || "", claimedRowIndex: r1.claimedRowIndex },
    worker2: { claimedFileId: r2.claimedFileId || "", claimedRowIndex: r2.claimedRowIndex },
    sameClaim: sameClaim
  };
  Logger.log(res);
  return res;
}
