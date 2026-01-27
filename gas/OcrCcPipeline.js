// @ts-check

// NOTE: Keep comments ASCII only.

function belle_ocr_cc_runOnce_(ctx) {
  const c = ctx || {};
  const props = c.props || belle_cfg_getProps_();
  const fileId = String(c.fileId || "");
  const attempt = Number(c.attempt || 0) || 0;
  const maxAttempts = Number(c.maxAttempts || 0) || 0;
  const statusBefore = String(c.statusBefore || "");
  const prevErrorCode = String(c.prevErrorCode || "");
  const prevError = String(c.prevError || "");
  const prevErrorDetail = String(c.prevErrorDetail || "");
  const ocrJsonBefore = String(c.ocrJsonBefore || "");
  const backoffSeconds = Number(c.backoffSeconds || 0) || 0;

  let ccStage = "";
  let ccCacheHit = false;
  let ccStage2Attempted = false;
  let geminiElapsedMs = 0;
  let ccGeminiMs = 0;
  let httpStatus = 0;
  let jsonStr = "";
  let statusOut = "";
  let outcome = "";
  let errorCode = "";
  let errorMessage = "";
  let errorDetail = "";
  let nextRetryIso = "";
  let keepOcrJsonOnError = false;
  let throwError = "";

  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();

  const cacheInfo = belle_ocr_cc_detectStageFromCache_(ocrJsonBefore);
  ccStage = cacheInfo.stage;
  ccCacheHit = ccStage === "stage2";

  if (cacheInfo.cacheInvalid) {
    errorCode = "CC_STAGE1_CACHE_INVALID";
    errorMessage = BELLE_DOC_TYPE_CC_STATEMENT + " stage1 cache invalid";
    errorDetail = belle_ocr_buildInvalidSchemaLogDetail_(ocrJsonBefore);
  }

  if (ccStage === "stage1") {
    const stage1Prompt = belle_ocr_getCcStage1Prompt_();
    const stage1Options = {
      promptText: stage1Prompt,
      generationConfig: belle_ocr_cc_getStage1GenCfg_(props)
    };
    if (belle_ocr_cc_enableResponseMimeType_(props)) stage1Options.responseMimeType = "application/json";
    if (belle_ocr_cc_enableResponseJsonSchema_(props)) stage1Options.responseJsonSchema = belle_ocr_cc_getStage1ResponseJsonSchema_();

    const geminiStartMs = Date.now();
    const stage1JsonStr = belle_callGeminiOcr(blob, stage1Options);
    geminiElapsedMs = Date.now() - geminiStartMs;
    ccGeminiMs = geminiElapsedMs;
    httpStatus = 200;
    jsonStr = stage1JsonStr;
    let stage1Parsed;
    try {
      stage1Parsed = JSON.parse(stage1JsonStr);
    } catch (e) {
      throwError = "INVALID_SCHEMA: CC_STAGE1_PARSE_ERROR";
      return {
        statusOut: statusOut,
        outcome: outcome,
        errorCode: errorCode,
        errorMessage: errorMessage,
        errorDetail: errorDetail,
        nextRetryIso: nextRetryIso,
        keepOcrJsonOnError: keepOcrJsonOnError,
        jsonStr: jsonStr,
        ccStage: ccStage,
        ccCacheHit: ccCacheHit,
        ccStage2Attempted: ccStage2Attempted,
        geminiElapsedMs: geminiElapsedMs,
        ccGeminiMs: ccGeminiMs,
        httpStatus: httpStatus,
        throwError: throwError
      };
    }
    const stage1Validation = belle_ocr_validateCcStage1_(stage1Parsed);
    if (!stage1Validation.ok) {
      throwError = "INVALID_SCHEMA: " + stage1Validation.reason;
      return {
        statusOut: statusOut,
        outcome: outcome,
        errorCode: errorCode,
        errorMessage: errorMessage,
        errorDetail: errorDetail,
        nextRetryIso: nextRetryIso,
        keepOcrJsonOnError: keepOcrJsonOnError,
        jsonStr: jsonStr,
        ccStage: ccStage,
        ccCacheHit: ccCacheHit,
        ccStage2Attempted: ccStage2Attempted,
        geminiElapsedMs: geminiElapsedMs,
        ccGeminiMs: ccGeminiMs,
        httpStatus: httpStatus,
        throwError: throwError
      };
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
      promptText: stage2Prompt,
      generationConfig: belle_ocr_cc_getStage2GenCfg_(props)
    };
    if (belle_ocr_cc_enableResponseMimeType_(props)) stage2Options.responseMimeType = "application/json";
    if (belle_ocr_cc_enableResponseJsonSchema_(props)) stage2Options.responseJsonSchema = belle_ocr_cc_getStage2ResponseJsonSchema_();

    const geminiStartMs = Date.now();
    const stage2JsonStr = belle_callGeminiOcr(blob, stage2Options);
    geminiElapsedMs = Date.now() - geminiStartMs;
    ccGeminiMs = geminiElapsedMs;
    httpStatus = 200;
    jsonStr = stage2JsonStr;
    const MAX_CELL_CHARS = 45000;
    if (jsonStr.length > MAX_CELL_CHARS) {
      throwError = "OCR JSON too long for single cell: " + jsonStr.length;
      return {
        statusOut: statusOut,
        outcome: outcome,
        errorCode: errorCode,
        errorMessage: errorMessage,
        errorDetail: errorDetail,
        nextRetryIso: nextRetryIso,
        keepOcrJsonOnError: keepOcrJsonOnError,
        jsonStr: jsonStr,
        ccStage: ccStage,
        ccCacheHit: ccCacheHit,
        ccStage2Attempted: ccStage2Attempted,
        geminiElapsedMs: geminiElapsedMs,
        ccGeminiMs: ccGeminiMs,
        httpStatus: httpStatus,
        throwError: throwError
      };
    }
    let parsed;
    try {
      parsed = JSON.parse(stage2JsonStr);
    } catch (e) {
      throwError = "INVALID_SCHEMA: PARSE_ERROR";
      return {
        statusOut: statusOut,
        outcome: outcome,
        errorCode: errorCode,
        errorMessage: errorMessage,
        errorDetail: errorDetail,
        nextRetryIso: nextRetryIso,
        keepOcrJsonOnError: keepOcrJsonOnError,
        jsonStr: jsonStr,
        ccStage: ccStage,
        ccCacheHit: ccCacheHit,
        ccStage2Attempted: ccStage2Attempted,
        geminiElapsedMs: geminiElapsedMs,
        ccGeminiMs: ccGeminiMs,
        httpStatus: httpStatus,
        throwError: throwError
      };
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
        throwError = "INVALID_SCHEMA: " + validation.reason;
        return {
          statusOut: statusOut,
          outcome: outcome,
          errorCode: errorCode,
          errorMessage: errorMessage,
          errorDetail: errorDetail,
          nextRetryIso: nextRetryIso,
          keepOcrJsonOnError: keepOcrJsonOnError,
          jsonStr: jsonStr,
          ccStage: ccStage,
          ccCacheHit: ccCacheHit,
          ccStage2Attempted: ccStage2Attempted,
          geminiElapsedMs: geminiElapsedMs,
          ccGeminiMs: ccGeminiMs,
          httpStatus: httpStatus,
          throwError: throwError
        };
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

  return {
    statusOut: statusOut,
    outcome: outcome,
    errorCode: errorCode,
    errorMessage: errorMessage,
    errorDetail: errorDetail,
    nextRetryIso: nextRetryIso,
    keepOcrJsonOnError: keepOcrJsonOnError,
    jsonStr: jsonStr,
    ccStage: ccStage,
    ccCacheHit: ccCacheHit,
    ccStage2Attempted: ccStage2Attempted,
    geminiElapsedMs: geminiElapsedMs,
    ccGeminiMs: ccGeminiMs,
    httpStatus: httpStatus,
    throwError: throwError
  };
}
