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

function belle_perf_getHeaderV2_() {
  return [
    "logged_at_iso",
    "phase",
    "ok",
    "doc_type",
    "queue_sheet_name",
    "last_reason",
    "lock_busy_skipped",
    "http_status",
    "cc_error_code",
    "cc_stage",
    "cc_cache_hit",
    "processing_count",
    "detail_json"
  ];
}

function belle_perf_buildRowV2_(evt) {
  const e = evt || {};
  let detail = "";
  try {
    detail = JSON.stringify(e);
  } catch (err) {
    detail = String(e);
  }
  detail = belle_ocr_perf_truncate_(detail, 2000);
  const okValue = (e.ok === undefined || e.ok === null) ? "" : (e.ok === true ? "true" : "false");
  const cacheValue = (e.ccCacheHit === undefined || e.ccCacheHit === null) ? "" : (e.ccCacheHit === true ? "true" : "false");
  const httpStatus = (typeof e.httpStatus === "number" && !isNaN(e.httpStatus)) ? e.httpStatus : "";
  const lockBusySkipped = (typeof e.lockBusySkipped === "number" && !isNaN(e.lockBusySkipped)) ? e.lockBusySkipped : "";
  const processingCount = (typeof e.processingCount === "number" && !isNaN(e.processingCount)) ? e.processingCount : "";
  return [
    new Date().toISOString(),
    String(e.phase || "OCR_WORKER_SUMMARY"),
    okValue,
    String(e.docType || e.doc_type || ""),
    String(e.queueSheetName || e.queue_sheet_name || ""),
    String(e.lastReason || ""),
    lockBusySkipped,
    httpStatus,
    String(e.ccErrorCode || ""),
    String(e.ccStage || ""),
    cacheValue,
    processingCount,
    detail
  ];
}