// @ts-check

// NOTE: Keep comments ASCII only.

function belle_ocr_receipt_runOnce_(ctx) {
  const c = ctx || {};
  const props = c.props || belle_cfg_getProps_();
  const fileId = String(c.fileId || "");
  const mimeType = String(c.mimeType || "");
  const docType = String(c.docType || "");
  const attempt = Number(c.attempt || 0) || 0;
  const maxAttempts = Number(c.maxAttempts || 0) || 0;
  const statusBefore = String(c.statusBefore || "");
  const prevErrorCode = String(c.prevErrorCode || "");
  const prevError = String(c.prevError || "");
  const prevErrorDetail = String(c.prevErrorDetail || "");

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
    jsonStr = belle_callGeminiOcr(blob, { temperature: tempInfo.temperature });
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
      geminiElapsedMs: geminiElapsedMs,
      httpStatus: httpStatus,
      throwError: throwError
    };
  }

  const validation = belle_ocr_validateSchema(parsed);
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
      geminiElapsedMs: geminiElapsedMs,
      httpStatus: httpStatus,
      throwError: throwError
    };
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