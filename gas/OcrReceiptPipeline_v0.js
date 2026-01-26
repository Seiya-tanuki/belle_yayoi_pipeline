// @ts-check

// NOTE: Keep comments ASCII only.

function belle_ocr_receipt_runOnce_(ctx) {
  const c = ctx || {};
  const props = c.props || belle_cfg_getProps_();
  const fileId = String(c.fileId || "");
  const mimeType = String(c.mimeType || "");
  const docType = String(c.docType || "");
  const docSpec = belle_docType_getSpec_(docType);
  const attempt = Number(c.attempt || 0) || 0;
  const maxAttempts = Number(c.maxAttempts || 0) || 0;
  const statusBefore = String(c.statusBefore || "");
  const prevErrorCode = String(c.prevErrorCode || "");
  const prevError = String(c.prevError || "");
  const prevErrorDetail = String(c.prevErrorDetail || "");

  const backoffSeconds = Number(props.getProperty("BELLE_OCR_RETRY_BACKOFF_SECONDS") || "300");
  let geminiElapsedMs = 0;
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

  function buildInvalidSchemaResult_(reason) {
    const message = "INVALID_SCHEMA: " + String(reason || "");
    let status = "ERROR_RETRYABLE";
    let code = "INVALID_SCHEMA";
    if (attempt >= maxAttempts) {
      status = "ERROR_FINAL";
      code = "MAX_ATTEMPTS_EXCEEDED";
    }
    const detail = jsonStr ? belle_ocr_buildInvalidSchemaLogDetail_(jsonStr) : "";
    const nextRetry = status === "ERROR_RETRYABLE"
      ? new Date(Date.now() + belle_ocr_worker_calcBackoffMs_(attempt, backoffSeconds)).toISOString()
      : "";
    return {
      statusOut: status,
      outcome: status,
      errorCode: code,
      errorMessage: message,
      errorDetail: detail,
      nextRetryIso: nextRetry,
      keepOcrJsonOnError: keepOcrJsonOnError,
      jsonStr: jsonStr,
      geminiElapsedMs: geminiElapsedMs,
      httpStatus: httpStatus,
      throwError: ""
    };
  }

  function buildBankNoRowsResult_() {
    const message = "BANK_NO_ROWS_EXTRACTED";
    let status = "ERROR_RETRYABLE";
    let code = "BANK_NO_ROWS_EXTRACTED";
    if (attempt >= maxAttempts) {
      status = "ERROR_FINAL";
      code = "MAX_ATTEMPTS_EXCEEDED";
    }
    const nextRetry = status === "ERROR_RETRYABLE"
      ? new Date(Date.now() + belle_ocr_worker_calcBackoffMs_(attempt, backoffSeconds)).toISOString()
      : "";
    return {
      statusOut: status,
      outcome: status,
      errorCode: code,
      errorMessage: message,
      errorDetail: message,
      nextRetryIso: nextRetry,
      keepOcrJsonOnError: keepOcrJsonOnError,
      jsonStr: jsonStr,
      geminiElapsedMs: geminiElapsedMs,
      httpStatus: httpStatus,
      throwError: ""
    };
  }

  function isBankStatement_() {
    return docType === BELLE_DOC_TYPE_BANK_STATEMENT;
  }

  function resolvePromptText_() {
    if (docSpec && typeof docSpec.stage2_prompt_getter === "function") {
      return docSpec.stage2_prompt_getter();
    }
    return "";
  }

  function validateParsed_(parsed) {
    if (isBankStatement_()) return belle_ocr_validateBankStatement_(parsed);
    return belle_ocr_validateSchema(parsed);
  }

  if (mimeType === "application/pdf" && !belle_ocr_allowPdfForDocType_(docType)) {
    outcome = "ERROR_FINAL";
    statusOut = "ERROR_FINAL";
    errorCode = "UNSUPPORTED_PDF";
    errorMessage = "PDF not supported in v0";
    errorDetail = "PDF not supported in v0";
    return {
      statusOut: statusOut,
      outcome: outcome,
      errorCode: errorCode,
      errorMessage: errorMessage,
      errorDetail: errorDetail,
      nextRetryIso: nextRetryIso,
      keepOcrJsonOnError: keepOcrJsonOnError,
      jsonStr: jsonStr,
      geminiElapsedMs: geminiElapsedMs,
      httpStatus: httpStatus,
      throwError: throwError
    };
  }

  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const tempInfo = belle_ocr_computeGeminiTemperature_({
    attempt: attempt,
    maxAttempts: maxAttempts,
    statusBefore: statusBefore,
    prevErrorCode: prevErrorCode,
    prevError: prevError,
    prevErrorDetail: prevErrorDetail
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
      prevErrorCode: prevErrorCode
    });
  }

  const geminiStartMs = Date.now();
  try {
    const promptText = resolvePromptText_();
    const geminiOptions = { temperature: tempInfo.temperature };
    if (promptText) geminiOptions.promptText = promptText;
    if (isBankStatement_()) {
      const bankGenCfg = belle_cfg_getBankStage2GenCfgOverride_(props);
      if (bankGenCfg) geminiOptions.generationConfig = bankGenCfg;
    }
    jsonStr = belle_callGeminiOcr(blob, geminiOptions);
  } catch (e) {
    geminiElapsedMs = Date.now() - geminiStartMs;
    throwError = String(e && e.message ? e.message : e);
    return {
      statusOut: statusOut,
      outcome: outcome,
      errorCode: errorCode,
      errorMessage: errorMessage,
      errorDetail: errorDetail,
      nextRetryIso: nextRetryIso,
      keepOcrJsonOnError: keepOcrJsonOnError,
      jsonStr: jsonStr,
      geminiElapsedMs: geminiElapsedMs,
      httpStatus: httpStatus,
      throwError: throwError
    };
  }
  geminiElapsedMs = Date.now() - geminiStartMs;
  httpStatus = 200;

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
      geminiElapsedMs: geminiElapsedMs,
      httpStatus: httpStatus,
      throwError: throwError
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return buildInvalidSchemaResult_("PARSE_ERROR");
  }

  if (isBankStatement_()) {
    if (Array.isArray(parsed && parsed.transactions) && parsed.transactions.length === 0) {
      return buildBankNoRowsResult_();
    }
  }

  const validation = validateParsed_(parsed);
  if (!validation.ok) {
    return buildInvalidSchemaResult_(validation.reason);
  }

  outcome = "DONE";
  statusOut = "DONE";

  return {
    statusOut: statusOut,
    outcome: outcome,
    errorCode: errorCode,
    errorMessage: errorMessage,
    errorDetail: errorDetail,
    nextRetryIso: nextRetryIso,
    keepOcrJsonOnError: keepOcrJsonOnError,
    jsonStr: jsonStr,
    geminiElapsedMs: geminiElapsedMs,
    httpStatus: httpStatus,
    throwError: throwError
  };
}
