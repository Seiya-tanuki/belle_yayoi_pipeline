// @ts-check

/**
 * @deprecated Fallback-v0 uses runner/queue/export entrypoints.
 */
function belle_healthCheck() {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys();
  Logger.log({ ok: true, propertyKeys: keys, now: new Date().toISOString() });
  return { ok: true, propertyKeys: keys, now: new Date().toISOString() };
}

/**
 * @deprecated Configure Script Properties via UI. This helper is not used in fallback-v0.
 */
function belle_setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  // Example (leave commented):
  // props.setProperties({
  //   BELLE_SHEET_ID: "",
  //   BELLE_SHEET_NAME: "OCR_RAW"
  // }, true);
  Logger.log("belle_setupScriptProperties: done");
}

/**
 * @deprecated Use belle_queueFolderFilesToSheet for queueing. Not used in fallback-v0.
 */
function belle_appendRow(values) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const sheetName = props.getProperty("BELLE_SHEET_NAME") || "OCR_RAW";

  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!Array.isArray(values)) throw new Error("values must be an array");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);

  sh.appendRow(values);
}

/**
 * @deprecated Use belle_queueFolderFilesToSheet_test. Not used in fallback-v0.
 */
function belle_appendRow_test() {
  belle_appendRow(["TEST", new Date().toISOString(), "hello"]);
}

/**
 * List files under BELLE_DRIVE_FOLDER_ID.
 * - Filters: image/* and application/pdf
 * - Read-only. No delete/move.
 */
function belle_listFilesInFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("BELLE_DRIVE_FOLDER_ID");
  if (!folderId) throw new Error("Missing Script Property: BELLE_DRIVE_FOLDER_ID");

  const folder = DriveApp.getFolderById(folderId);
  const it = folder.getFiles();
  const files = [];

  while (it.hasNext()) {
    const f = it.next();
    const mime = f.getMimeType();
    const isImage = mime && mime.indexOf("image/") === 0;
    const isPdf = mime === "application/pdf";
    if (!isImage && !isPdf) continue;

    files.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: mime,
      createdAt: f.getDateCreated() ? f.getDateCreated().toISOString() : null,
      url: "https://drive.google.com/file/d/" + f.getId() + "/view"
    });
  }

  Logger.log({ ok: true, count: files.length });
  return { ok: true, count: files.length, files: files };
}

/**
 * Append-only queue writer:
 * Writes QUEUED rows into the configured sheet.
 *
 * Sheet properties:
 * - BELLE_SHEET_ID (required)
 * - BELLE_QUEUE_SHEET_NAME (preferred)
 * - BELLE_SHEET_NAME (legacy fallback)
 *
 * Queue row schema (8 cols):
 * 1 status
 * 2 file_id
 * 3 file_name
 * 4 mime_type
 * 5 drive_url
 * 6 queued_at_iso
 * 7 ocr_json (empty for now)
 * 8 ocr_error (empty for now)
 */
function belle_queueFolderFilesToSheet() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const queueSheetName = belle_getQueueSheetName(props);

  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const listed = belle_listFilesInFolder();
  const files = listed.files || [];

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) throw new Error("Sheet not found: " + queueSheetName);

  const header = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
  }

  const existing = new Set();
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const vals = sh.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i][0];
      if (v) existing.add(String(v));
    }
  }

  const nowIso = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || !f.id) continue;
    if (existing.has(String(f.id))) continue;
    rows.push([
      "QUEUED",
      String(f.id),
      String(f.name || ""),
      String(f.mimeType || ""),
      String(f.url || ""),
      nowIso,
      "",
      ""
    ]);
  }

  if (rows.length > 0) {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rows.length, header.length).setValues(rows);
  }

  const result = {
    ok: true,
    queued: rows.length,
    skipped: files.length - rows.length,
    totalListed: files.length
  };
  Logger.log(result);
  return result;
}

/**
 * Manual test runner (dev only).
 * Run this from the Apps Script editor.
 */
function belle_queueFolderFilesToSheet_test() {
  return belle_queueFolderFilesToSheet();
}

/**
 * Read required properties for Gemini call.
 * Required:
 * - BELLE_GEMINI_API_KEY
 * - BELLE_GEMINI_MODEL (example: "gemini-2.0-flash" or your working model name)
 * Optional:
 * - BELLE_GEMINI_SLEEP_MS (default 500)
 * - BELLE_MAX_ITEMS_PER_RUN (default 1)
 */
function belle_getGeminiConfig() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("BELLE_GEMINI_API_KEY");
  const model = props.getProperty("BELLE_GEMINI_MODEL");
  const sleepMs = Number(props.getProperty("BELLE_GEMINI_SLEEP_MS") || "500");
  const maxItems = Number(props.getProperty("BELLE_MAX_ITEMS_PER_RUN") || "1");
  if (!apiKey) throw new Error("Missing Script Property: BELLE_GEMINI_API_KEY");
  if (!model) throw new Error("Missing Script Property: BELLE_GEMINI_MODEL");
  return { apiKey: apiKey, model: model, sleepMs: sleepMs, maxItems: maxItems };
}

/**
 * Call Gemini generateContent with image inline data.
 * NOTE: Endpoint may vary by your setup. This uses Generative Language API style.
 */
function belle_callGeminiOcr(imageBlob) {
  const cfg = belle_getGeminiConfig();
  const prompt = (typeof BELLE_OCR_PROMPT_V0 !== "undefined") ? BELLE_OCR_PROMPT_V0 : "";
  if (!prompt) throw new Error("Missing OCR prompt constant: BELLE_OCR_PROMPT_V0");

  const mimeType = imageBlob.getContentType();
  const b64 = Utilities.base64Encode(imageBlob.getBytes());
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(cfg.model) + ":generateContent?key=" + encodeURIComponent(cfg.apiKey);

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: b64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.0
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const text = res.getContentText() || "";
  if (status < 200 || status >= 300) {
    throw new Error("Gemini HTTP " + status + ": " + text.slice(0, 500));
  }

  let out = text;
  try {
    const j = JSON.parse(text);
    const c = j && j.candidates && j.candidates[0] && j.candidates[0].content;
    const parts = c && c.parts;
    if (parts && parts[0] && typeof parts[0].text === "string") out = parts[0].text;
  } catch (e) {
    // keep raw text
  }

  const trimmed = String(out || "").trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    throw new Error("OCR output is not valid JSON: " + trimmed.slice(0, 200));
  }

  return JSON.stringify(parsed);
}

function belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader) {
  const required = baseHeader.concat(extraHeader || []);
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(required);
  }

  let headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let nextCol = headerRow.length + 1;
  for (let i = 0; i < required.length; i++) {
    if (headerRow.indexOf(required[i]) === -1) {
      sh.getRange(1, nextCol).setValue(required[i]);
      nextCol++;
    }
  }

  headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    map[String(headerRow[i] || "")] = i;
  }

  for (let i = 0; i < baseHeader.length; i++) {
    if (map[baseHeader[i]] === undefined) {
      return null;
    }
  }
  return map;
}

function belle_ocr_classifyError(message) {
  const msg = String(message || "").toLowerCase();
  const retryable = [
    "timeout",
    "timed out",
    "rate limit",
    "429",
    "quota",
    "temporar",
    "network",
    "5xx",
    "500",
    "502",
    "503",
    "504"
  ];
  const nonRetryable = [
    "invalid argument",
    "permission",
    "forbidden",
    "unauthorized",
    "unauthenticated",
    "401",
    "403",
    "404",
    "not found",
    "400"
  ];
  for (let i = 0; i < nonRetryable.length; i++) {
    if (msg.indexOf(nonRetryable[i]) >= 0) {
      return { retryable: false, code: "NON_RETRYABLE" };
    }
  }
  for (let i = 0; i < retryable.length; i++) {
    if (msg.indexOf(retryable[i]) >= 0) {
      return { retryable: true, code: "RETRYABLE" };
    }
  }
  return { retryable: true, code: "RETRYABLE" };
}

function belle_configWarnOnce(key, detail) {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get(key)) return;
    cache.put(key, "1", 21600);
  } catch (e) {
    // ignore cache errors
  }
  Logger.log({ phase: "CONFIG_WARN", key: key, detail: detail || "" });
}

function belle_getQueueSheetName(props) {
  const p = props || PropertiesService.getScriptProperties();
  const name = p.getProperty("BELLE_QUEUE_SHEET_NAME");
  if (name) return name;
  const legacy = p.getProperty("BELLE_SHEET_NAME");
  if (legacy) {
    belle_configWarnOnce("BELLE_SHEET_NAME_DEPRECATED", "Use BELLE_QUEUE_SHEET_NAME instead.");
    return legacy;
  }
  return "OCR_RAW";
}


function belle_getSkipLogSheetName(props) {
  const p = props || PropertiesService.getScriptProperties();
  return p.getProperty("BELLE_SKIP_LOG_SHEET_NAME") || "EXPORT_SKIP_LOG";
}

function belle_getOutputFolderId(props) {
  const p = props || PropertiesService.getScriptProperties();
  return p.getProperty("BELLE_OUTPUT_FOLDER_ID") || p.getProperty("BELLE_DRIVE_FOLDER_ID");
}

/**
 * Process QUEUED rows in the queue sheet.
 * Updates only these columns for the matched row:
 * - status
 * - ocr_json
 * - ocr_error
 */
function belle_processQueueOnce(options) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const queueSheetName = belle_getQueueSheetName(props);
  const maxAttempts = Number(props.getProperty("BELLE_OCR_MAX_ATTEMPTS") || "3");
  const backoffSeconds = Number(props.getProperty("BELLE_OCR_RETRY_BACKOFF_SECONDS") || "300");
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const useLock = !(options && options.skipLock === true);
  const lock = useLock ? LockService.getScriptLock() : null;
  if (useLock) lock.waitLock(30000);

  try {
    const cfg = belle_getGeminiConfig();

    const ss = SpreadsheetApp.openById(sheetId);
    const sh = ss.getSheetByName(queueSheetName);
    if (!sh) throw new Error("Sheet not found: " + queueSheetName);

    const baseHeader = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
    const extraHeader = ["ocr_attempts","ocr_last_attempt_at_iso","ocr_next_retry_at_iso","ocr_error_code","ocr_error_detail"];
    const lastRow = sh.getLastRow();
    if (lastRow < 1) {
      return { ok: false, processed: 0, reason: "QUEUE_EMPTY: sheet has no header" };
    }

    const headerMap = belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader);
    if (!headerMap) {
      return { ok: false, processed: 0, reason: "INVALID_QUEUE_HEADER: missing required columns" };
    }

    if (lastRow < 2) {
      return { ok: false, processed: 0, reason: "QUEUE_EMPTY: run belle_queueFolderFilesToSheet first" };
    }

    const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    let processed = 0;
    let scanned = 0;
    const processedRows = [];
    let errorsCount = 0;

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

      if (!fileId) continue;
      if (status === "DONE") continue;
      if (ocrJson) continue;

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
        status: status || "QUEUED"
      });

      try {
        if (mimeType === "application/pdf") {
          sh.getRange(sheetRow, headerMap["status"] + 1).setValue("ERROR_FINAL");
          sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue("PDF not supported in v0");
          sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue("UNSUPPORTED_PDF");
          sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue("PDF not supported in v0");
          sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
          Logger.log({ phase: "OCR_ITEM_DONE", row: sheetRow, file_id: fileId, status: "ERROR_FINAL" });
          processedRows.push(sheetRow);
          processed++;
          errorsCount++;
          continue;
        }

        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        const jsonStr = belle_callGeminiOcr(blob);
        const MAX_CELL_CHARS = 45000;
        if (jsonStr.length > MAX_CELL_CHARS) {
          throw new Error("OCR JSON too long for single cell: " + jsonStr.length);
        }

        sh.getRange(sheetRow, headerMap["ocr_json"] + 1).setValue(jsonStr);
        sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue("");
        sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue("");
        sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue("");
        sh.getRange(sheetRow, headerMap["ocr_next_retry_at_iso"] + 1).setValue("");
        sh.getRange(sheetRow, headerMap["status"] + 1).setValue("DONE");
        Logger.log({ phase: "OCR_ITEM_DONE", row: sheetRow, file_id: fileId, status: "DONE" });
        processedRows.push(sheetRow);
        processed++;

        if (cfg.sleepMs > 0) Utilities.sleep(cfg.sleepMs);
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        const detail = msg.slice(0, 500);
        const classify = belle_ocr_classifyError(msg);
        const retryable = classify.retryable === true;
        let statusOut = retryable ? "ERROR_RETRYABLE" : "ERROR_FINAL";
        let errorCode = classify.code;
        if (retryable && attempt >= maxAttempts) {
          statusOut = "ERROR_FINAL";
          errorCode = "MAX_ATTEMPTS_EXCEEDED";
        }
        sh.getRange(sheetRow, headerMap["ocr_error"] + 1).setValue(msg.slice(0, 200));
        sh.getRange(sheetRow, headerMap["ocr_error_code"] + 1).setValue(errorCode);
        sh.getRange(sheetRow, headerMap["ocr_error_detail"] + 1).setValue(detail);
        sh.getRange(sheetRow, headerMap["status"] + 1).setValue(statusOut);
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
          message: msg.slice(0, 200)
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
      errorsCount: errorsCount
    };
    Logger.log(result);
    return result;
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * Manual test runner (dev only).
 */
function belle_processQueueOnce_test() {
  return belle_processQueueOnce();
}

/**
 * Append skip details to a sheet (append-only).
 */
function belle_appendSkipLogRows(ss, sheetName, details, exportedAtIso) {
  if (!details || details.length === 0) return 0;
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  const header = ["exported_at_iso","file_id","file_name","reason"];
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(header);
  } else {
    const headerRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
    for (let i = 0; i < header.length; i++) {
      if (String(headerRow[i] || "") !== header[i]) {
        throw new Error("INVALID_SKIP_LOG_HEADER: mismatch at col " + (i + 1));
      }
    }
  }

  const rows = [];
  for (let i = 0; i < details.length; i++) {
    const d = details[i] || {};
    rows.push([exportedAtIso, d.file_id || "", d.file_name || "", d.reason || ""]);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
  return rows.length;
}

function belle_parseBool(value, defaultValue) {
  if (value === null || value === undefined || value === "") return defaultValue;
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultValue;
}

function belle_queue_getStatusCounts() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const queueSheetName = belle_getQueueSheetName(props);
  if (!sheetId || !queueSheetName) return { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) return { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };

  const baseHeader = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
  const extraHeader = ["ocr_attempts","ocr_last_attempt_at_iso","ocr_next_retry_at_iso","ocr_error_code","ocr_error_detail"];
  const headerMap = belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader);
  if (!headerMap) return { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const counts = { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const fileId = String(row[headerMap["file_id"]] || "");
    if (!fileId) continue;
    counts.totalCount++;
    const status = String(row[headerMap["status"]] || "");
    const normalized = status || "QUEUED";
    if (normalized === "DONE") counts.doneCount++;
    else if (normalized === "ERROR_FINAL") counts.errorFinalCount++;
    else if (normalized === "ERROR_RETRYABLE" || normalized === "ERROR") counts.errorRetryableCount++;
    else counts.queuedRemaining++;
  }
  return counts;
}

/**
 * Runner: queue -> ocr (batch).
 * Uses ScriptLock and stops by time or item limits.
 */
function belle_runPipelineBatch_v0() {
  const props = PropertiesService.getScriptProperties();
  const maxSeconds = Number(props.getProperty("BELLE_RUN_MAX_SECONDS") || "240");
  const maxOcrItems = Number(props.getProperty("BELLE_RUN_MAX_OCR_ITEMS_PER_BATCH") || "5");
  const doQueue = belle_parseBool(props.getProperty("BELLE_RUN_DO_QUEUE"), true);
  const doOcr = belle_parseBool(props.getProperty("BELLE_RUN_DO_OCR"), true);

  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const maxMs = Math.max(1, maxSeconds) * 1000;
  function hasBudget(marginMs) {
    const margin = marginMs === undefined ? 3000 : marginMs;
    return (Date.now() - startMs) < (maxMs - margin);
  }

  const summary = {
    phase: "RUN_SUMMARY",
    ok: true,
    totalListed: 0,
    queuedAdded: 0,
    ocrProcessed: 0,
    ocrErrors: 0,
    queuedRemaining: 0,
    reason: "",
    startedAt: startedAt,
    endedAt: ""
  };

  const reasons = [];
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(500)) {
    const guard = {
      phase: "RUN_GUARD",
      ok: true,
      reason: "LOCK_BUSY",
      startedAt: startedAt,
      endedAt: new Date().toISOString()
    };
    Logger.log(guard);
    return guard;
  }
  Logger.log({ phase: "RUN_START", ok: true, startedAt: startedAt });

  try {
    if (!hasBudget()) {
      reasons.push("TIME_BUDGET_EXCEEDED");
      Logger.log({ phase: "RUN_STOP", ok: true, reason: "TIME_BUDGET_EXCEEDED", processedSoFar: summary.ocrProcessed });
      return summary;
    }
    if (doQueue) {
      const q = belle_queueFolderFilesToSheet();
      summary.queuedAdded += q && q.queued ? q.queued : 0;
    }

    if (doOcr && hasBudget()) {
      let loops = 0;
      while (loops < maxOcrItems && hasBudget()) {
        const r = belle_processQueueOnce({ skipLock: true });
        const processed = r && r.processed ? r.processed : 0;
        if (processed === 0) {
          reasons.push("OCR_NO_PROGRESS");
          break;
        }
        summary.ocrProcessed += processed;
        summary.ocrErrors += r && r.errorsCount ? r.errorsCount : 0;
        loops++;
      }
      if (loops >= maxOcrItems && summary.ocrProcessed > 0) {
        reasons.push("HIT_MAX_OCR_ITEMS_PER_BATCH");
      }
      if (!hasBudget(0)) {
        reasons.push("TIME_BUDGET_EXCEEDED");
      }
    }

  } catch (e) {
    reasons.push("ERROR: " + String(e && e.message ? e.message : e).slice(0, 200));
    summary.ok = false;
  } finally {
    const counts = belle_queue_getStatusCounts();
    summary.totalListed = counts.totalCount;
    summary.queuedRemaining = counts.queuedRemaining;
    if (summary.queuedAdded === 0 && summary.ocrProcessed === 0) {
      summary.reason = "NO_QUEUED_ITEMS";
    } else if (summary.ocrProcessed === 0 && summary.queuedRemaining === 0) {
      summary.reason = "NO_OCR_TARGETS";
    } else if (reasons.indexOf("OCR_NO_PROGRESS") >= 0) {
      summary.reason = "OCR_NO_PROGRESS";
    } else if (reasons.indexOf("HIT_MAX_OCR_ITEMS_PER_BATCH") >= 0) {
      summary.reason = "HIT_MAX_OCR_ITEMS_PER_BATCH";
    } else if (reasons.indexOf("TIME_BUDGET_EXCEEDED") >= 0) {
      summary.reason = "TIME_BUDGET_EXCEEDED";
    } else if (reasons.length > 0) {
      summary.reason = reasons.join(";");
    } else {
      summary.reason = "OK";
    }
    summary.endedAt = new Date().toISOString();
    Logger.log(summary);
    try {
      lock.releaseLock();
    } catch (e) {
      Logger.log({ phase: "RUN_LOCK_RELEASE_ERROR", ok: false, reason: "LOCK_RELEASE_FAILED" });
    }
  }

  return summary;
}

/**
 * Manual test runner (dev only).
 */
function belle_runPipelineBatch_v0_test() {
  const result = belle_runPipelineBatch_v0();
  Logger.log(result);
  return result;
}
