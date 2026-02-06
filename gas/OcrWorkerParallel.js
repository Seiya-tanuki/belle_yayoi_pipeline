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

function belle_ocr_worker_dispatchByPipelineKind_(pipelineKind, handlers) {
  if (pipelineKind === BELLE_DOC_PIPELINE_TWO_STAGE) {
    return handlers && handlers.two_stage ? handlers.two_stage() : null;
  }
  if (pipelineKind === BELLE_DOC_PIPELINE_INACTIVE) {
    return handlers && handlers.inactive ? handlers.inactive() : null;
  }
  return handlers && handlers.single_stage ? handlers.single_stage() : null;
}

function belle_ocr_worker_state_prepareClaim_(ctx) {
  const sheetId = belle_cfg_getSheetIdOrThrow_(ctx.props);
  const queueSheetName = ctx.claim.queueSheetName || belle_getQueueSheetName(ctx.props);
  const maxAttempts = Number(ctx.props.getProperty("BELLE_OCR_MAX_ATTEMPTS") || "3");
  const backoffSeconds = Number(ctx.props.getProperty("BELLE_OCR_RETRY_BACKOFF_SECONDS") || "300");
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) throw new Error("Sheet not found: " + queueSheetName);

  const baseHeader = belle_getQueueHeaderColumns();
  const extraHeader = belle_getQueueLockHeaderColumns_();
  const headerMap = belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader);
  if (!headerMap) {
    return { done: true, result: { ok: false, processed: 0, reason: "INVALID_QUEUE_HEADER" } };
  }

  const rowIndex = ctx.claim.rowIndex;
  const row = sh.getRange(rowIndex, 1, 1, sh.getLastColumn()).getValues()[0];
  const fileId = String(row[headerMap["file_id"]] || "");
  const mimeType = String(row[headerMap["mime_type"]] || "");
  const status = String(row[headerMap["status"]] || "");
  const statusBefore = ctx.claim.statusBefore || status;
  const rowDocType = headerMap["doc_type"] !== undefined ? String(row[headerMap["doc_type"]] || "") : "";
  const docType = rowDocType || ctx.claim.docType || "";
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
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const rowNow = sh.getRange(rowIndex, 1, 1, sh.getLastColumn()).getValues()[0];
    const ownerNow = String(rowNow[headerMap["ocr_lock_owner"]] || "");
    const statusNow = String(rowNow[headerMap["status"]] || "");
    if (ownerNow !== ctx.workerId || statusNow !== "PROCESSING") {
      const totalNow = Date.now() - ctx.totalStart;
      const res = {
        ok: true,
        processed: 0,
        reason: "CLAIM_LOST",
        file_id: fileId,
        rowIndex: rowIndex,
        claimElapsedMs: ctx.claimElapsedMs,
        statusBefore: statusBefore,
        totalItemElapsedMs: totalNow,
        geminiElapsedMs: 0,
        classify: "",
        httpStatus: 0,
        docType: docType,
        queueSheetName: queueSheetName,
        processingCount: ctx.processingCount
      };
      Logger.log({ phase: "OCR_WORKER_ITEM", workerId: ctx.workerId, outcome: "CLAIM_LOST", file_id: fileId, rowIndex: rowIndex, docType: docType });
      return { done: true, result: res };
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

  return {
    done: false,
    prepared: {
      props: ctx.props,
      workerId: ctx.workerId,
      totalStart: ctx.totalStart,
      claimElapsedMs: ctx.claimElapsedMs,
      processingCount: ctx.processingCount,
      maxAttempts: maxAttempts,
      backoffSeconds: backoffSeconds,
      queueSheetName: queueSheetName,
      sh: sh,
      headerMap: headerMap,
      rowIndex: rowIndex,
      fileId: fileId,
      mimeType: mimeType,
      statusBefore: statusBefore,
      docType: docType,
      docSpec: docSpec,
      pipelineKind: pipelineKind,
      isTwoStage: isTwoStage,
      ocrJsonBefore: ocrJsonBefore,
      ocrError: ocrError,
      ocrErrorCode: ocrErrorCode,
      ocrErrorDetail: ocrErrorDetail,
      attempt: attempt
    }
  };
}

function belle_ocr_worker_state_dispatchRunOnce_(prepared) {
  const runOnceFnName = belle_ocr_getRunOnceFnNameForDocType_(prepared.docType);
  const g = (typeof globalThis !== "undefined") ? globalThis : this;
  const state = {
    outcome: "",
    jsonStr: "",
    errorCode: "",
    errorDetail: "",
    errorMessage: "",
    nextRetryIso: "",
    statusOut: "",
    geminiElapsedMs: 0,
    geminiStartMs: 0,
    httpStatus: 0,
    classify: "",
    totalItemElapsedMs: 0,
    ccStage: "",
    ccCacheHit: false,
    ccGeminiMs: 0,
    ccStage2Attempted: false,
    keepOcrJsonOnError: false
  };

  function setErrorFinal_(code, message) {
    state.statusOut = "ERROR_FINAL";
    state.outcome = "ERROR_FINAL";
    state.errorCode = code;
    state.errorMessage = message;
    state.errorDetail = message;
  }

  function applyRunOnceResult_(result) {
    if (!result) return;
    state.geminiElapsedMs = result.geminiElapsedMs;
    state.httpStatus = result.httpStatus;
    state.jsonStr = result.jsonStr;
    state.statusOut = result.statusOut;
    state.outcome = result.outcome;
    state.errorCode = result.errorCode;
    state.errorMessage = result.errorMessage;
    state.errorDetail = result.errorDetail;
    state.nextRetryIso = result.nextRetryIso;
    state.keepOcrJsonOnError = result.keepOcrJsonOnError === true;
    if (typeof result.ccStage === "string") state.ccStage = result.ccStage;
    if (result.ccCacheHit !== undefined) state.ccCacheHit = result.ccCacheHit;
    if (result.ccStage2Attempted !== undefined) state.ccStage2Attempted = result.ccStage2Attempted;
    if (result.ccGeminiMs !== undefined) state.ccGeminiMs = result.ccGeminiMs;
    if (result.throwError) throw new Error(result.throwError);
  }

  function callRunOnce_() {
    if (!prepared.docSpec) {
      setErrorFinal_("UNSUPPORTED_SINGLE_STAGE_DOC_TYPE", "Unsupported single stage docType: " + prepared.docType);
      return;
    }
    if (!runOnceFnName) {
      setErrorFinal_("MISSING_OCR_RUN_ONCE_FN", "Missing ocr_run_once_fn for docType: " + prepared.docType);
      return;
    }
    const runOnce = g[runOnceFnName];
    if (typeof runOnce !== "function") {
      setErrorFinal_("OCR_RUN_ONCE_NOT_FOUND", "ocr_run_once_fn not found: " + runOnceFnName);
      return;
    }
    const result = runOnce({
      props: prepared.props,
      fileId: prepared.fileId,
      mimeType: prepared.mimeType,
      docType: prepared.docType,
      attempt: prepared.attempt,
      maxAttempts: prepared.maxAttempts,
      statusBefore: prepared.statusBefore,
      prevErrorCode: prepared.ocrErrorCode,
      prevError: prepared.ocrError,
      prevErrorDetail: prepared.ocrErrorDetail,
      ocrJsonBefore: prepared.ocrJsonBefore,
      backoffSeconds: prepared.backoffSeconds
    });
    applyRunOnceResult_(result);
  }

  try {
    belle_ocr_worker_dispatchByPipelineKind_(prepared.pipelineKind, {
      two_stage: function () { callRunOnce_(); },
      single_stage: function () { callRunOnce_(); },
      inactive: function () {
        state.statusOut = "ERROR_FINAL";
        state.outcome = "ERROR_FINAL";
        state.errorCode = "DOC_TYPE_INACTIVE";
        state.errorMessage = "DOC_TYPE_INACTIVE";
        state.errorDetail = "DOC_TYPE_INACTIVE";
      }
    });
    return state;
  } catch (e) {
    if (e && typeof e === "object") e.belleWorkerState = state;
    throw e;
  }
}

function belle_ocr_worker_state_classifyError_(prepared, state, err) {
  const msg = String(err && err.message ? err.message : err);
  if (state.geminiStartMs > 0 && state.geminiElapsedMs === 0) {
    state.geminiElapsedMs = Date.now() - state.geminiStartMs;
  }
  if (prepared.isTwoStage && state.ccGeminiMs === 0 && state.geminiElapsedMs > 0) {
    state.ccGeminiMs = state.geminiElapsedMs;
  }
  let detail = msg.slice(0, 500);
  const classified = belle_ocr_classifyError(msg);
  const retryable = classified.retryable === true;
  state.statusOut = retryable ? "ERROR_RETRYABLE" : "ERROR_FINAL";
  state.errorCode = classified.code;
  if (retryable && prepared.attempt >= prepared.maxAttempts) {
    state.statusOut = "ERROR_FINAL";
    state.errorCode = "MAX_ATTEMPTS_EXCEEDED";
  }
  state.httpStatus = belle_ocr_extractHttpStatus_(msg);
  state.errorMessage = msg.slice(0, 200);
  if (state.errorCode === "INVALID_SCHEMA" && state.jsonStr) {
    detail = belle_ocr_buildInvalidSchemaLogDetail_(state.jsonStr);
  }
  state.errorDetail = detail;
  if (prepared.isTwoStage && state.ccStage2Attempted) {
    state.keepOcrJsonOnError = true;
  }
  if (state.statusOut === "ERROR_RETRYABLE") {
    const backoff = belle_ocr_worker_calcBackoffMs_(prepared.attempt, prepared.backoffSeconds);
    state.nextRetryIso = new Date(Date.now() + backoff).toISOString();
  }
  state.outcome = state.statusOut;
  return state;
}

function belle_ocr_worker_state_commitWriteback_(prepared, state) {
  if (!state.classify) {
    if (state.statusOut === "DONE") state.classify = "DONE";
    else if (state.errorCode === "INVALID_SCHEMA") state.classify = "INVALID_SCHEMA";
    else state.classify = state.statusOut || "";
  }

  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const rowNow = prepared.sh.getRange(prepared.rowIndex, 1, 1, prepared.sh.getLastColumn()).getValues()[0];
    const ownerNow = String(rowNow[prepared.headerMap["ocr_lock_owner"]] || "");
    const statusNow = String(rowNow[prepared.headerMap["status"]] || "");
    if (ownerNow !== prepared.workerId || statusNow !== "PROCESSING") {
      const totalNow = Date.now() - prepared.totalStart;
      const res = {
        ok: true,
        processed: 0,
        reason: "CLAIM_LOST",
        file_id: prepared.fileId,
        rowIndex: prepared.rowIndex,
        claimElapsedMs: prepared.claimElapsedMs,
        statusBefore: prepared.statusBefore,
        totalItemElapsedMs: totalNow,
        geminiElapsedMs: state.geminiElapsedMs,
        classify: state.classify,
        httpStatus: state.httpStatus,
        docType: prepared.docType,
        queueSheetName: prepared.queueSheetName,
        processingCount: prepared.processingCount
      };
      Logger.log({ phase: "OCR_WORKER_ITEM", workerId: prepared.workerId, outcome: "CLAIM_LOST", file_id: prepared.fileId, rowIndex: prepared.rowIndex, docType: prepared.docType });
      return { done: true, result: res };
    }

    prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_lock_owner"] + 1).setValue("");
    prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_lock_until_iso"] + 1).setValue("");
    prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_processing_started_at_iso"] + 1).setValue("");

    if (state.statusOut === "DONE") {
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_json"] + 1).setValue(state.jsonStr);
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error_code"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error_detail"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["status"] + 1).setValue("DONE");
    } else if (state.statusOut === "QUEUED") {
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_json"] + 1).setValue(state.jsonStr);
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error_code"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error_detail"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["status"] + 1).setValue("QUEUED");
    } else {
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error"] + 1).setValue(state.errorMessage);
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error_code"] + 1).setValue(state.errorCode);
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_error_detail"] + 1).setValue(state.errorDetail);
      if (!state.keepOcrJsonOnError) {
        prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_json"] + 1).setValue("");
      }
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["ocr_next_retry_at_iso"] + 1).setValue(state.nextRetryIso);
      prepared.sh.getRange(prepared.rowIndex, prepared.headerMap["status"] + 1).setValue(state.statusOut);
    }

    return { done: false };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function belle_ocr_worker_state_projectTelemetry_(prepared, state) {
  state.totalItemElapsedMs = Date.now() - prepared.totalStart;
  Logger.log({
    phase: "OCR_WORKER_ITEM",
    file_id: prepared.fileId,
    rowIndex: prepared.rowIndex,
    outcome: state.outcome,
    attempt: prepared.attempt,
    workerId: prepared.workerId,
    geminiElapsedMs: state.geminiElapsedMs,
    totalItemElapsedMs: state.totalItemElapsedMs,
    classify: state.classify,
    httpStatus: state.httpStatus,
    docType: prepared.docType,
    queueSheetName: prepared.queueSheetName,
    ccStage: state.ccStage,
    ccCacheHit: state.ccCacheHit,
    ccGeminiMs: state.ccGeminiMs,
    ccHttpStatus: state.httpStatus,
    ccErrorCode: state.errorCode,
    processingCount: prepared.processingCount
  });

  return {
    ok: true,
    processed: 1,
    outcome: state.outcome,
    file_id: prepared.fileId,
    rowIndex: prepared.rowIndex,
    claimElapsedMs: prepared.claimElapsedMs,
    statusBefore: prepared.statusBefore,
    geminiElapsedMs: state.geminiElapsedMs,
    totalItemElapsedMs: state.totalItemElapsedMs,
    classify: state.classify,
    httpStatus: state.httpStatus,
    docType: prepared.docType,
    queueSheetName: prepared.queueSheetName,
    ccStage: state.ccStage,
    ccCacheHit: state.ccCacheHit,
    ccGeminiMs: state.ccGeminiMs,
    ccHttpStatus: state.httpStatus,
    ccErrorCode: state.errorCode,
    processingCount: prepared.processingCount
  };
}

function belle_ocr_workerOnce_(opts) {
  const totalStart = Date.now();
  const props = belle_cfg_getProps_();
  const workerId = opts && opts.workerId ? String(opts.workerId) : Utilities.getUuid();
  let processingCount = 0;
  const docTypesRaw = opts && Array.isArray(opts.docTypes) && opts.docTypes.length > 0
    ? opts.docTypes
    : belle_ocr_getActiveDocTypes_(props);
  const docTypes = [];
  for (let i = 0; i < docTypesRaw.length; i++) {
    const docType = docTypesRaw[i];
    const spec = belle_docType_getSpec_(docType);
    if (spec && spec.pipeline_kind === BELLE_DOC_PIPELINE_INACTIVE) continue;
    docTypes.push(docType);
  }
  if (docTypes.length === 0) {
    return {
      ok: true,
      processed: 0,
      reason: "NO_TARGET",
      claimElapsedMs: 0,
      totalItemElapsedMs: Date.now() - totalStart,
      geminiElapsedMs: 0,
      classify: "",
      httpStatus: 0,
      processingCount: processingCount
    };
  }

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

  const preparedStep = belle_ocr_worker_state_prepareClaim_({
    props: props,
    workerId: workerId,
    claim: claim,
    claimElapsedMs: claimElapsedMs,
    processingCount: processingCount,
    totalStart: totalStart
  });
  if (preparedStep.done) {
    return preparedStep.result;
  }

  const prepared = preparedStep.prepared;
  let state = null;
  try {
    state = belle_ocr_worker_state_dispatchRunOnce_(prepared);
  } catch (e) {
    if (e && typeof e === "object" && e.belleWorkerState) {
      state = e.belleWorkerState;
    }
    if (!state) {
      state = {
        outcome: "",
        jsonStr: "",
        errorCode: "",
        errorDetail: "",
        errorMessage: "",
        nextRetryIso: "",
        statusOut: "",
        geminiElapsedMs: 0,
        geminiStartMs: 0,
        httpStatus: 0,
        classify: "",
        totalItemElapsedMs: 0,
        ccStage: "",
        ccCacheHit: false,
        ccGeminiMs: 0,
        ccStage2Attempted: false,
        keepOcrJsonOnError: false
      };
    }
    state = belle_ocr_worker_state_classifyError_(prepared, state, e);
  }

  const committed = belle_ocr_worker_state_commitWriteback_(prepared, state);
  if (committed.done) {
    return committed.result;
  }
  return belle_ocr_worker_state_projectTelemetry_(prepared, state);
}
function belle_ocr_workerLoop_(opts) {
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
    const r = belle_ocr_workerOnce_({ workerId: workerId, lockMode: lockMode, lockWaitMs: lockWaitMs, docTypes: docTypes });
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

