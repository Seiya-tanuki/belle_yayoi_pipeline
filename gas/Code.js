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
  //   BELLE_SHEET_NAME: "OCR_RECEIPT"
  // }, true);
  Logger.log("belle_setupScriptProperties: done");
}

/**
 * @deprecated Use belle_queueFolderFilesToSheet for queueing. Not used in fallback-v0.
 */
function belle_appendRow(values) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const sheetName = belle_ocr_getQueueSheetNameForDocType_(props, "receipt");

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
  const defs = belle_getDocTypeDefs_();
  const activeDocTypes = belle_ocr_getActiveDocTypes_(props);
  const activeSet = {};
  for (let i = 0; i < activeDocTypes.length; i++) activeSet[activeDocTypes[i]] = true;

  const files = [];
  const filesByDocType = {};
  const skipped = [];

  const rootFiles = folder.getFiles();
  while (rootFiles.hasNext()) {
    const f = rootFiles.next();
    skipped.push({
      file_id: f.getId(),
      file_name: f.getName(),
      drive_url: "https://drive.google.com/file/d/" + f.getId() + "/view",
      reason: "ROOT_LEVEL_FILE",
      detail: "",
      doc_type: "",
      source_subfolder: ""
    });
  }

  const foldersByName = {};
  const unknownFolders = [];
  const folderIt = folder.getFolders();
  while (folderIt.hasNext()) {
    const sub = folderIt.next();
    const name = String(sub.getName() || "");
    const def = belle_ocr_getDocTypeDefBySubfolder_(name);
    if (def) {
      if (!foldersByName[name]) foldersByName[name] = [];
      foldersByName[name].push(sub);
    } else {
      unknownFolders.push(sub);
    }
  }

  for (let i = 0; i < unknownFolders.length; i++) {
    const sub = unknownFolders[i];
    skipped.push({
      file_id: sub.getId(),
      file_name: sub.getName(),
      drive_url: "https://drive.google.com/drive/folders/" + sub.getId(),
      reason: "UNKNOWN_SUBFOLDER",
      detail: "",
      doc_type: "",
      source_subfolder: sub.getName()
    });
  }

  const duplicateDocTypes = {};
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const list = foldersByName[def.subfolder] || [];
    if (list.length > 1) {
      duplicateDocTypes[def.docType] = true;
      const ids = [];
      for (let j = 0; j < list.length; j++) ids.push(list[j].getId());
      skipped.push({
        file_id: "",
        file_name: def.subfolder,
        drive_url: "",
        reason: "DUPLICATE_SUBFOLDER_NAME",
        detail: "count=" + list.length + " ids=" + ids.join(","),
        doc_type: def.docType,
        source_subfolder: def.subfolder
      });
    }
  }

  const inactiveDocTypes = {};
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const list = foldersByName[def.subfolder] || [];
    if (list.length > 0 && !activeSet[def.docType]) {
      inactiveDocTypes[def.docType] = true;
      skipped.push({
        file_id: list[0].getId(),
        file_name: list[0].getName(),
        drive_url: "https://drive.google.com/drive/folders/" + list[0].getId(),
        reason: "DOC_TYPE_INACTIVE",
        detail: "",
        doc_type: def.docType,
        source_subfolder: def.subfolder
      });
    }
  }

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (!activeSet[def.docType]) continue;
    if (duplicateDocTypes[def.docType]) continue;
    const list = foldersByName[def.subfolder] || [];
    if (list.length === 0) continue;
    const sub = list[0];
    const it = sub.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const mime = f.getMimeType();
      const isImage = mime && mime.indexOf("image/") === 0;
      const isPdf = mime === "application/pdf";
      if (!isImage && !isPdf) continue;
      if (isPdf) {
        const skipDetail = belle_queue_checkPdfPageCount_(f, def.docType, def.subfolder);
        if (skipDetail) {
          skipped.push(skipDetail);
          continue;
        }
      }
      const entry = {
        id: f.getId(),
        name: f.getName(),
        mimeType: mime,
        createdAt: f.getDateCreated() ? f.getDateCreated().toISOString() : null,
        url: "https://drive.google.com/file/d/" + f.getId() + "/view",
        doc_type: def.docType,
        source_subfolder: def.subfolder
      };
      files.push(entry);
      if (!filesByDocType[def.docType]) filesByDocType[def.docType] = [];
      filesByDocType[def.docType].push(entry);
    }
  }

  Logger.log({ ok: true, count: files.length });
  return { ok: true, count: files.length, files: files, filesByDocType: filesByDocType, skipped: skipped };
}

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

function belle_getExportLogHeaderColumns_v0() {
  return ["file_id","exported_at_iso","csv_file_id"];
}

function belle_getDocTypeDefs_() {
  return [
    { docType: "receipt", subfolder: "receipt", sheetName: "OCR_RECEIPT" },
    { docType: "cc_statement", subfolder: "cc_statement", sheetName: "OCR_CC" },
    { docType: "bank_statement", subfolder: "bank_statement", sheetName: "OCR_BANK" }
  ];
}

function belle_ocr_getDocTypeDefByDocType_(docType) {
  const key = String(docType || "");
  const defs = belle_getDocTypeDefs_();
  for (let i = 0; i < defs.length; i++) {
    if (defs[i].docType === key) return defs[i];
  }
  return null;
}

function belle_ocr_getDocTypeDefBySubfolder_(name) {
  const key = String(name || "");
  const defs = belle_getDocTypeDefs_();
  for (let i = 0; i < defs.length; i++) {
    if (defs[i].subfolder === key) return defs[i];
  }
  return null;
}

function belle_ocr_getActiveDocTypes_(props) {
  const p = props || PropertiesService.getScriptProperties();
  const raw = String(p.getProperty("BELLE_ACTIVE_DOC_TYPES") || "").trim();
  if (!raw) return ["receipt"];
  const parts = raw.split(",");
  const out = [];
  const seen = {};
  for (let i = 0; i < parts.length; i++) {
    const item = String(parts[i] || "").trim();
    if (!item) continue;
    const def = belle_ocr_getDocTypeDefByDocType_(item);
    if (!def) {
      belle_configWarnOnce("BELLE_ACTIVE_DOC_TYPES_UNKNOWN", "unknown=" + item);
      continue;
    }
    if (!seen[def.docType]) {
      seen[def.docType] = true;
      out.push(def.docType);
    }
  }
  if (out.length === 0) return ["receipt"];
  return out;
}

function belle_ocr_getFixedQueueSheetNameForDocType_(docType) {
  const def = belle_ocr_getDocTypeDefByDocType_(docType);
  return def ? def.sheetName : "OCR_RECEIPT";
}

function belle_ocr_getQueueSheetNameForDocType_(props, docType) {
  const p = props || PropertiesService.getScriptProperties();
  const key = String(docType || "receipt");
  if (key === "receipt") {
    const name = p.getProperty("BELLE_QUEUE_SHEET_NAME");
    if (name) return name;
    const legacy = p.getProperty("BELLE_SHEET_NAME");
    if (legacy) {
      belle_configWarnOnce("BELLE_SHEET_NAME_DEPRECATED", "Use BELLE_QUEUE_SHEET_NAME instead.");
      return legacy;
    }
  }
  return belle_ocr_getFixedQueueSheetNameForDocType_(key);
}

/**
 * Append-only queue writer (doc_type routing by subfolder).
 */
function belle_queueFolderFilesToSheet() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

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
    const headerMap = belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader);
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

function belle_ocr_clampTemperature_(value) {
  const n = Number(value);
  if (isNaN(n)) return 0.0;
  if (n < 0) return 0.0;
  if (n > 2) return 2.0;
  return n;
}

function belle_ocr_parseTemperatureValue_(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (isNaN(n)) return fallback;
  return belle_ocr_clampTemperature_(n);
}

function belle_ocr_computeGeminiTemperatureWithConfig_(ctx, config) {
  const defaultTemp = belle_ocr_parseTemperatureValue_(config && config.defaultRaw, 0.0);
  const addTemp = belle_ocr_parseTemperatureValue_(config && config.addRaw, 0.0);
  const attempt = Number((ctx && ctx.attempt) || 0);
  const maxAttempts = Number((ctx && ctx.maxAttempts) || 0);
  const statusBefore = String((ctx && ctx.statusBefore) || "");
  const prevErrorCode = String((ctx && ctx.prevErrorCode) || "");
  const prevError = String((ctx && ctx.prevError) || "");
  const prevErrorDetail = String((ctx && ctx.prevErrorDetail) || "");
  const combined = (prevError + " " + prevErrorDetail);
  const isRetry = statusBefore === "ERROR_RETRYABLE" || statusBefore === "ERROR";
  const isFinalAttempt = attempt > 0 && maxAttempts > 0 && attempt === maxAttempts;
  const isInvalidSchema = prevErrorCode === "INVALID_SCHEMA" || combined.indexOf("INVALID_SCHEMA") >= 0;
  const is503 = combined.indexOf("503") >= 0;

  let temperature = defaultTemp;
  let overridden = false;
  if (isRetry && isFinalAttempt && isInvalidSchema && !is503 && addTemp > 0) {
    temperature = belle_ocr_clampTemperature_(defaultTemp + addTemp);
    overridden = true;
  }
  return {
    temperature: temperature,
    overridden: overridden,
    defaultTemp: defaultTemp,
    addTemp: addTemp
  };
}

function belle_ocr_computeGeminiTemperature_(ctx) {
  const props = PropertiesService.getScriptProperties();
  const defaultRaw = props.getProperty("BELLE_GEMINI_TEMPERATURE_DEFAULT");
  const addRaw = props.getProperty("BELLE_GEMINI_TEMPERATURE_FINAL_RETRY_ADD");
  return belle_ocr_computeGeminiTemperatureWithConfig_(ctx, { defaultRaw: defaultRaw, addRaw: addRaw });
}

/**
 * Call Gemini generateContent with image inline data.
 * NOTE: Endpoint may vary by your setup. This uses Generative Language API style.
 */
function belle_ocr_getCcStage1Prompt_() {
  const prompt = (typeof BELLE_OCR_CC_STAGE1_PROMPT_V0 !== "undefined") ? BELLE_OCR_CC_STAGE1_PROMPT_V0 : "";
  if (!prompt) throw new Error("Missing OCR prompt constant: BELLE_OCR_CC_STAGE1_PROMPT_V0");
  return prompt;
}

function belle_ocr_getCcStage2Prompt_() {
  const prompt = (typeof BELLE_OCR_CC_STAGE2_PROMPT_V0 !== "undefined") ? BELLE_OCR_CC_STAGE2_PROMPT_V0 : "";
  if (!prompt) throw new Error("Missing OCR prompt constant: BELLE_OCR_CC_STAGE2_PROMPT_V0");
  return prompt;
}

function belle_ocr_allowPdfForDocType_(docType) {
  return String(docType || "") === "cc_statement";
}

function belle_ocr_cc_classifyStage1Page_(pageType) {
  const t = String(pageType || "");
  if (t === "transactions") {
    return { proceed: true, statusOut: "", errorCode: "", errorMessage: "" };
  }
  if (t === "non_transactions") {
    return { proceed: false, statusOut: "ERROR_FINAL", errorCode: "CC_NON_TRANSACTION_PAGE", errorMessage: "cc_statement page_type=non_transactions" };
  }
  return { proceed: false, statusOut: "ERROR_RETRYABLE", errorCode: "CC_PAGE_UNKNOWN", errorMessage: "cc_statement page_type=unknown" };
}

function belle_ocr_cc_detectStageFromCache_(ocrJsonStr) {
  const raw = String(ocrJsonStr || "").trim();
  if (!raw) return { stage: "stage1", cacheInvalid: false };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.task === "page_classification" && parsed.page_type === "transactions") {
      return { stage: "stage2", cacheInvalid: false };
    }
    return { stage: "stage1", cacheInvalid: true };
  } catch (e) {
    return { stage: "stage1", cacheInvalid: false };
  }
}

function belle_ocr_cc_buildStage1Writeback_(pageType, stage1JsonStr) {
  const decision = belle_ocr_cc_classifyStage1Page_(pageType);
  if (decision.proceed) {
    return {
      statusOut: "QUEUED",
      errorCode: "",
      errorMessage: "",
      errorDetail: "",
      cacheJson: stage1JsonStr,
      clearErrors: true,
      retryable: false
    };
  }
  return {
    statusOut: decision.statusOut,
    errorCode: decision.errorCode,
    errorMessage: decision.errorMessage,
    errorDetail: belle_ocr_buildInvalidSchemaLogDetail_(stage1JsonStr),
    cacheJson: "",
    clearErrors: false,
    retryable: decision.statusOut === "ERROR_RETRYABLE"
  };
}

function belle_ocr_cc_buildStage2SuccessWriteback_(stage2JsonStr) {
  return { statusOut: "DONE", errorCode: "", errorMessage: "", errorDetail: "", nextJson: stage2JsonStr, clearErrors: true };
}

function belle_ocr_cc_buildStage2NoRowsWriteback_(stage2JsonStr) {
  return {
    statusOut: "ERROR_RETRYABLE",
    errorCode: "CC_NO_ROWS_EXTRACTED",
    errorMessage: "transactions empty",
    errorDetail: "transactions empty",
    keepCache: true
  };
}

function belle_ocr_cc_parseGenCfg_(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object") return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}

function belle_ocr_cc_mergeGenCfg_(baseCfg, overrideCfg) {
  const base = baseCfg && typeof baseCfg === "object" ? baseCfg : {};
  const out = {};
  const keys = Object.keys(base);
  for (let i = 0; i < keys.length; i++) out[keys[i]] = base[keys[i]];
  if (overrideCfg && typeof overrideCfg === "object") {
    const overrideKeys = Object.keys(overrideCfg);
    for (let j = 0; j < overrideKeys.length; j++) {
      out[overrideKeys[j]] = overrideCfg[overrideKeys[j]];
    }
  }
  return out;
}

function belle_ocr_cc_getStage1GenCfg_(props) {
  const p = props || PropertiesService.getScriptProperties();
  const defaults = { temperature: 0.0, topP: 0.1, maxOutputTokens: 512, thinkingConfig: { thinkingLevel: "low" } };
  const override = belle_ocr_cc_parseGenCfg_(p.getProperty("BELLE_CC_STAGE1_GENCFG_JSON"), null);
  return belle_ocr_cc_mergeGenCfg_(defaults, override);
}

function belle_ocr_cc_getStage2GenCfg_(props) {
  const p = props || PropertiesService.getScriptProperties();
  const defaults = { temperature: 0.0, topP: 0.1, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } };
  const override = belle_ocr_cc_parseGenCfg_(p.getProperty("BELLE_CC_STAGE2_GENCFG_JSON"), null);
  return belle_ocr_cc_mergeGenCfg_(defaults, override);
}

function belle_ocr_cc_enableResponseJsonSchema_(props) {
  const p = props || PropertiesService.getScriptProperties();
  return belle_parseBool(p.getProperty("BELLE_CC_ENABLE_RESPONSE_JSON_SCHEMA"), false);
}

function belle_ocr_cc_enableResponseMimeType_(props) {
  const p = props || PropertiesService.getScriptProperties();
  return belle_parseBool(p.getProperty("BELLE_CC_ENABLE_RESPONSE_MIME_TYPE"), false);
}

function belle_ocr_cc_getStage1ResponseJsonSchema_() {
  return {
    type: "object",
    properties: {
      task: { type: "string", enum: ["page_classification"] },
      page_type: { type: "string", enum: ["transactions", "non_transactions", "unknown"] },
      reason_codes: { type: "array", items: { type: "string" } },
      page_issues: { type: "array", items: { type: "string" } }
    },
    required: ["task", "page_type", "reason_codes", "page_issues"],
    additionalProperties: false
  };
}

function belle_ocr_cc_getStage2ResponseJsonSchema_() {
  return {
    type: "object",
    properties: {
      task: { type: "string", enum: ["transaction_extraction"] },
      transactions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            row_no: { type: "number" },
            raw_use_date_text: { type: "string" },
            use_month: { type: "number" },
            use_day: { type: "number" },
            merchant: { type: "string" },
            amount_yen: { type: "number" },
            amount_sign: { type: "string", enum: ["debit", "credit"] },
            issues: { type: "array", items: { type: "string" } }
          },
          required: ["row_no", "raw_use_date_text", "use_month", "use_day", "merchant", "amount_yen", "amount_sign", "issues"],
          additionalProperties: false
        }
      }
    },
    required: ["task", "transactions"],
    additionalProperties: false
  };
}

function belle_ocr_shouldStopAfterItem_(docType) {
  return String(docType || "") === "cc_statement";
}

function belle_callGeminiOcr(imageBlob, opt) {
  const cfg = belle_getGeminiConfig();
  const defaultPrompt = (typeof BELLE_OCR_PROMPT_V0 !== "undefined") ? BELLE_OCR_PROMPT_V0 : "";
  const prompt = (opt && opt.promptText) ? String(opt.promptText) : defaultPrompt;
  if (!prompt) throw new Error("Missing OCR prompt constant: BELLE_OCR_PROMPT_V0");

  const mimeType = imageBlob.getContentType();
  const b64 = Utilities.base64Encode(imageBlob.getBytes());
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(cfg.model) + ":generateContent?key=" + encodeURIComponent(cfg.apiKey);
  const temp = (opt && typeof opt.temperature === "number" && !isNaN(opt.temperature))
    ? belle_ocr_clampTemperature_(opt.temperature)
    : 0.0;
  const responseMimeType = opt && opt.responseMimeType ? String(opt.responseMimeType) : "";
  const responseJsonSchema = opt && opt.responseJsonSchema ? opt.responseJsonSchema : null;
  const generationConfigOverride = opt && opt.generationConfig ? opt.generationConfig : null;

  const generationConfig = { temperature: temp };
  if (generationConfigOverride && typeof generationConfigOverride === "object") {
    const overrideKeys = Object.keys(generationConfigOverride);
    for (let i = 0; i < overrideKeys.length; i++) {
      generationConfig[overrideKeys[i]] = generationConfigOverride[overrideKeys[i]];
    }
  }
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }
  if (responseJsonSchema && typeof responseJsonSchema === "object") {
    generationConfig.responseJsonSchema = responseJsonSchema;
  }

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: b64 } }
      ]
    }],
    generationConfig: generationConfig
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
  if (!key) return "BELLE_OCR_CLAIM_CURSOR";
  return "BELLE_OCR_CLAIM_CURSOR__" + key;
}

function belle_ocr_buildInvalidSchemaLogDetail_(jsonStr) {
  const MAX_CELL_CHARS = 45000;
  const s = String(jsonStr || "");
  if (s.length <= MAX_CELL_CHARS) return s;
  return s.slice(0, MAX_CELL_CHARS);
}

function belle_ocr_classifyError(message) {
  const msg = String(message || "").toLowerCase();
  const retryable = [
    "invalid_schema",
    "empty_response",
    "ocr output is not valid json",
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
      const code = (msg.indexOf("invalid_schema") >= 0 || msg.indexOf("empty_response") >= 0 || msg.indexOf("ocr output is not valid json") >= 0)
        ? "INVALID_SCHEMA"
        : "RETRYABLE";
      return { retryable: true, code: code };
    }
  }
  return { retryable: true, code: "RETRYABLE" };
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
  return belle_ocr_getQueueSheetNameForDocType_(props, "receipt");
}


function belle_getSkipLogSheetName(props) {
  const p = props || PropertiesService.getScriptProperties();
  return p.getProperty("BELLE_SKIP_LOG_SHEET_NAME") || "EXPORT_SKIP_LOG";
}

function belle_getQueueSkipLogSheetName(props) {
  const p = props || PropertiesService.getScriptProperties();
  return p.getProperty("BELLE_QUEUE_SKIP_LOG_SHEET_NAME") || "QUEUE_SKIP_LOG";
}

function belle_getOutputFolderId(props) {
  const p = props || PropertiesService.getScriptProperties();
  return p.getProperty("BELLE_OUTPUT_FOLDER_ID") || p.getProperty("BELLE_DRIVE_FOLDER_ID");
}

function belle_pdf_countPages_(pdfBlob, out) {
  try {
    if (!pdfBlob || typeof pdfBlob.getBytes !== "function") return null;
    const bytes = pdfBlob.getBytes();
    if (!bytes || !bytes.length) return null;

    const countFromPages = belle_pdf_scanPagesCount_(bytes);
    if (countFromPages !== null) {
      if (out) {
        out.method = "byte_scan:pages_count";
        out.pagesCount = countFromPages;
      }
      return countFromPages;
    }

    const countFromType = belle_pdf_scanTypePageCount_(bytes);
    if (countFromType !== null) {
      if (out) {
        out.method = "byte_scan:type_page_count";
        out.typePageCount = countFromType;
      }
      return countFromType;
    }

    if (out) out.method = "byte_scan:none";
    return null;
  } catch (e) {
    if (out) out.error = String(e);
    return null;
  }
}

function belle_pdf_scanPagesCount_(bytes) {
  const tokens = ["/Type /Pages", "/Type/Pages"];
  for (let t = 0; t < tokens.length; t++) {
    const tokenBytes = belle_pdf_tokenToBytes_(tokens[t]);
    let idx = 0;
    while (idx <= bytes.length - tokenBytes.length) {
      const found = belle_pdf_findTokenIndex_(bytes, tokenBytes, idx);
      if (found < 0) break;
      const count = belle_pdf_findCountNear_(bytes, found + tokenBytes.length, found + tokenBytes.length + 256);
      if (count !== null && count >= 1) return count;
      idx = found + tokenBytes.length;
    }
  }
  return null;
}

function belle_pdf_scanTypePageCount_(bytes) {
  const typeToken = belle_pdf_tokenToBytes_("/Type");
  const pageToken = belle_pdf_tokenToBytes_("/Page");
  let count = 0;
  for (let i = 0; i <= bytes.length - typeToken.length; i++) {
    let match = true;
    for (let j = 0; j < typeToken.length; j++) {
      if (bytes[i + j] !== typeToken[j]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    let k = i + typeToken.length;
    while (k < bytes.length && belle_pdf_isSpaceByte_(bytes[k])) k++;
    if (k + pageToken.length > bytes.length) continue;
    let pageMatch = true;
    for (let j = 0; j < pageToken.length; j++) {
      if (bytes[k + j] !== pageToken[j]) {
        pageMatch = false;
        break;
      }
    }
    if (!pageMatch) continue;
    const nextByte = bytes[k + pageToken.length];
    if (nextByte === 0x73) continue; // "/Pages"
    count++;
    if (count >= 2) return count;
  }
  if (count === 1) return 1;
  return null;
}

function belle_pdf_findCountNear_(bytes, start, end) {
  const max = Math.min(end, bytes.length);
  const token = belle_pdf_tokenToBytes_("/Count");
  for (let i = start; i <= max - token.length; i++) {
    let match = true;
    for (let j = 0; j < token.length; j++) {
      if (bytes[i + j] !== token[j]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    let k = i + token.length;
    while (k < max && belle_pdf_isSpaceByte_(bytes[k])) k++;
    let numStr = "";
    while (k < max) {
      const b = bytes[k];
      if (b >= 0x30 && b <= 0x39) {
        numStr += String.fromCharCode(b);
        k++;
        continue;
      }
      break;
    }
    if (numStr) {
      const n = Number(numStr);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function belle_pdf_findTokenIndex_(bytes, tokenBytes, start) {
  for (let i = start; i <= bytes.length - tokenBytes.length; i++) {
    let match = true;
    for (let j = 0; j < tokenBytes.length; j++) {
      if (bytes[i + j] !== tokenBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function belle_pdf_tokenToBytes_(token) {
  const out = [];
  for (let i = 0; i < token.length; i++) out.push(token.charCodeAt(i));
  return out;
}

function belle_pdf_isSpaceByte_(b) {
  return b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d || b === 0x0c;
}

function belle_queue_checkPdfPageCount_(file, docType, sourceSubfolder) {
  if (!file || typeof file.getMimeType !== "function") return null;
  if (file.getMimeType() !== "application/pdf") return null;
  const info = {};
  const pageCount = belle_pdf_countPages_(file.getBlob && file.getBlob(), info);
  if (pageCount === 1) return null;
  const reason = pageCount ? "MULTI_PAGE_PDF" : "PDF_PAGECOUNT_UNKNOWN";
  const method = info && info.method ? info.method : "byte_scan:none";
  let detail = "method=" + method;
  if (pageCount) detail += " detected_page_count=" + pageCount;
  else detail += " detected_page_count=unknown";
  if (info && info.pagesCount !== undefined) detail += " pages_count=" + info.pagesCount;
  if (info && info.typePageCount !== undefined) detail += " type_page_count=" + info.typePageCount;
  if (info && info.error) {
    detail += " error=" + String(info.error).slice(0, 200);
  }
  const id = typeof file.getId === "function" ? file.getId() : "";
  return {
    file_id: id,
    file_name: typeof file.getName === "function" ? file.getName() : "",
    drive_url: id ? "https://drive.google.com/file/d/" + id + "/view" : "",
    reason: reason,
    detail: detail,
    doc_type: docType || "",
    source_subfolder: sourceSubfolder || ""
  };
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
 * Process QUEUED rows in the queue sheet.
 * Updates only these columns for the matched row:
 * - status
 * - ocr_json
 * - ocr_error
 */
function belle_processQueueOnce(options) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

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
    return last || { ok: true, processed: 0, reason: "NO_TARGET" };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function belle_processQueueOnceForDocType_(props, docType, options) {
  const sheetId = props.getProperty("BELLE_SHEET_ID");
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
    return { ok: false, processed: 0, reason: "QUEUE_EMPTY: sheet has no header", docType: docType, queueSheetName: queueSheetName };
  }

  const headerMap = belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader);
  if (!headerMap) {
    return { ok: false, processed: 0, reason: "INVALID_QUEUE_HEADER: missing required columns", docType: docType, queueSheetName: queueSheetName };
  }

  if (lastRow < 2) {
    return { ok: false, processed: 0, reason: "QUEUE_EMPTY: run belle_queueFolderFilesToSheet first", docType: docType, queueSheetName: queueSheetName };
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
      const tempInfo = belle_ocr_computeGeminiTemperature_({
        attempt: attempt,
        maxAttempts: maxAttempts,
        statusBefore: normalized,
        prevErrorCode: ocrErrCode,
        prevError: ocrErr,
        prevErrorDetail: ocrErrDetail
      });
      if (tempInfo.overridden) {
        Logger.log({
          phase: "GEMINI_TEMPERATURE_POLICY",
          temperature: tempInfo.temperature,
          defaultTemp: tempInfo.defaultTemp,
          addTemp: tempInfo.addTemp,
          attempt: attempt,
          maxAttempts: maxAttempts,
          statusBefore: normalized,
          prevErrorCode: ocrErrCode,
          doc_type: rowDocType
        });
      }
      jsonStr = belle_callGeminiOcr(blob, { temperature: tempInfo.temperature });
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

/**
 * Manual test runner (dev only).
 */
function belle_processQueueOnce_test() {
  return belle_processQueueOnce();
}

function belle_ocr_claimNextRow_fallback_v0_(opts) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const docType = opts && opts.docType ? String(opts.docType) : "receipt";
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
    const headerMap = belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader);
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
    const legacyCursor = docType === "receipt" ? props.getProperty("BELLE_OCR_CLAIM_CURSOR") : "";
    const cursorRaw = props.getProperty(cursorKey) || legacyCursor;
    const scanPlan = belle_ocr_buildClaimScanPlan_(values.length, cursorRaw, scanMaxRaw);
    const scanIndices = scanPlan.indices;
    props.setProperty(cursorKey, String(scanPlan.nextCursor));
    if (docType === "receipt") {
      props.setProperty("BELLE_OCR_CLAIM_CURSOR", String(scanPlan.nextCursor));
    }

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

function belle_ocr_claimNextRow_fallback_v0_test() {
  const res = belle_ocr_claimNextRow_fallback_v0_({ workerId: "TEST_WORKER", ttlSeconds: 30 });
  Logger.log(res);
  return res;
}

function belle_ocr_claimNextRowByDocTypes_(opts) {
  const props = PropertiesService.getScriptProperties();
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

function belle_sheet_appendRowsInChunks_(sh, rows, chunkSize) {
  if (!rows || rows.length === 0) return 0;
  const sizeRaw = Number(chunkSize);
  const size = sizeRaw && isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : 200;
  let written = 0;
  let startRow = sh.getLastRow() + 1;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const width = chunk[0] ? chunk[0].length : 0;
    if (!width) continue;
    sh.getRange(startRow, 1, chunk.length, width).setValues(chunk);
    startRow += chunk.length;
    written += chunk.length;
  }
  return written;
}

/**
 * Append skip details to a sheet (append-only).
 */
function belle_getSkipLogHeader_() {
  return ["logged_at_iso","phase","file_id","file_name","drive_url","doc_type","source_subfolder","reason","detail"];
}

function belle_ensureSkipLogSheet_(ss, sheetName, header) {
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  } else {
    const headerRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
    const mismatch = header.some(function (h, i) {
      return String(headerRow[i] || "") !== h;
    });
    if (mismatch) {
      sh.clear();
      sh.getRange(1, 1, 1, header.length).setValues([header]);
    }
  }
  return sh;
}

function belle_appendSkipLogRows(ss, sheetName, details, loggedAtIso, phase) {
  if (!details || details.length === 0) return 0;
  const header = belle_getSkipLogHeader_();
  const sh = belle_ensureSkipLogSheet_(ss, sheetName, header);
  const rows = [];
  const phaseName = phase || "SKIP_LOG";
  const ts = loggedAtIso || new Date().toISOString();
  for (let i = 0; i < details.length; i++) {
    const d = details[i] || {};
    rows.push([
      ts,
      phaseName,
      d.file_id || "",
      d.file_name || "",
      d.drive_url || "",
      d.doc_type || "",
      d.source_subfolder || "",
      d.reason || "",
      d.detail || ""
    ]);
  }
  return belle_sheet_appendRowsInChunks_(sh, rows, 200);
}

function belle_queue_skip_makeKey_(fileId, reason) {
  return String(fileId || "") + "||" + String(reason || "");
}

function belle_appendQueueSkipLogRows_(ss, details, loggedAtIso, props) {
  if (!details || details.length === 0) return 0;
  const sheetName = belle_getQueueSkipLogSheetName(props);
  const header = belle_getSkipLogHeader_();
  const sh = belle_ensureSkipLogSheet_(ss, sheetName, header);
  const existing = new Set();
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const idValues = sh.getRange(2, 3, lastRow - 1, 1).getValues();
    const reasonValues = sh.getRange(2, 8, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      const key = belle_queue_skip_makeKey_(idValues[i][0], reasonValues[i][0]);
      existing.add(key);
    }
  }
  const rows = [];
  const phaseName = "QUEUE_SKIP";
  const ts = loggedAtIso || new Date().toISOString();
  for (let i = 0; i < details.length; i++) {
    const d = details[i] || {};
    const key = belle_queue_skip_makeKey_(d.file_id, d.reason);
    if (existing.has(key)) continue;
    existing.add(key);
    rows.push([
      ts,
      phaseName,
      d.file_id || "",
      d.file_name || "",
      d.drive_url || "",
      d.doc_type || "",
      d.source_subfolder || "",
      d.reason || "",
      d.detail || ""
    ]);
  }
  return belle_sheet_appendRowsInChunks_(sh, rows, 200);
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
  if (!sheetId) return { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };

  const ss = SpreadsheetApp.openById(sheetId);
  const counts = { totalCount: 0, queuedRemaining: 0, doneCount: 0, errorRetryableCount: 0, errorFinalCount: 0 };
  const docTypes = belle_ocr_getActiveDocTypes_(props);
  const baseHeader = belle_getQueueHeaderColumns_v0();
  const extraHeader = belle_getQueueLockHeaderColumns_v0_();
  for (let d = 0; d < docTypes.length; d++) {
    const docType = docTypes[d];
    const sheetName = belle_ocr_getQueueSheetNameForDocType_(props, docType);
    if (!sheetName) continue;
    const sh = ss.getSheetByName(sheetName);
    if (!sh) continue;
    const headerMap = belle_queue_ensureHeaderMap(sh, baseHeader, extraHeader);
    if (!headerMap) continue;
    const lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
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
  const parallelEnabled = belle_parseBool(props.getProperty("BELLE_OCR_PARALLEL_ENABLED"), false);

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

    if (doOcr && parallelEnabled) {
      Logger.log({ phase: "RUN_GUARD", ok: true, reason: "OCR_PARALLEL_ENABLED" });
    }

    if (doOcr && !parallelEnabled && hasBudget()) {
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



function belle_resetSpreadsheetToInitialState_fallback_v0() {
  const EXPECTED_RESET_TOKEN = "RESET_FALLBACK_V0_CONFIRM";
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty("BELLE_RESET_TOKEN") || "");
  if (token !== EXPECTED_RESET_TOKEN) {
    const guard = { phase: "RESET_GUARD", ok: true, reason: "RESET_TOKEN_MISMATCH" };
    Logger.log(guard);
    return guard;
  }

  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
  } catch (e) {
    const guard = { phase: "RESET_GUARD", ok: true, reason: "LOCK_BUSY" };
    Logger.log(guard);
    return guard;
  }

  try {
    const sheetId = props.getProperty("BELLE_SHEET_ID");
    if (!sheetId) {
      const guard = { phase: "RESET_GUARD", ok: true, reason: "MISSING_SHEET_ID" };
      Logger.log(guard);
      return guard;
    }

    const ss = SpreadsheetApp.openById(sheetId);
    const receiptSheetName = belle_ocr_getQueueSheetNameForDocType_(props, "receipt");
    const docDefs = belle_getDocTypeDefs_();
    const queueNames = [];
    for (let i = 0; i < docDefs.length; i++) {
      const name = belle_ocr_getQueueSheetNameForDocType_(props, docDefs[i].docType);
      if (queueNames.indexOf(name) < 0) queueNames.push(name);
    }
    const exportLogName = "EXPORT_LOG";
    const candidates = [
      receiptSheetName
    ];
    for (let i = 0; i < queueNames.length; i++) {
      candidates.push(queueNames[i]);
    }
    candidates.push(
      exportLogName,
      "QUEUE",
      "IMPORT_LOG",
      "REVIEW_UI",
      "REVIEW_STATE",
      "REVIEW_LOG"
    );
    const uniq = {};
    const targets = [];
    for (let i = 0; i < candidates.length; i++) {
      const name = candidates[i];
      if (name && !uniq[name]) {
        uniq[name] = true;
        targets.push(name);
      }
    }

    const existing = [];
    for (let i = 0; i < targets.length; i++) {
      const sh = ss.getSheetByName(targets[i]);
      if (sh) existing.push(sh);
    }

    let temp = null;
    if (existing.length > 0 && existing.length >= ss.getSheets().length) {
      temp = ss.insertSheet("__RESET_TMP__");
    }

    const deleted = [];
    for (let i = 0; i < existing.length; i++) {
      const sh = existing[i];
      deleted.push(sh.getName());
      ss.deleteSheet(sh);
    }

    const queueHeader = belle_getQueueHeaderColumns_v0();
    const createdSheets = [];
    for (let i = 0; i < queueNames.length; i++) {
      const name = queueNames[i];
      const queueSheet = ss.insertSheet(name);
      queueSheet.getRange(1, 1, 1, queueHeader.length).setValues([queueHeader]);
      createdSheets.push(name);
    }

    const exportLogSheet = ss.insertSheet(exportLogName);
    const exportHeader = belle_getExportLogHeaderColumns_v0();
    exportLogSheet.getRange(1, 1, 1, exportHeader.length).setValues([exportHeader]);

    if (temp) ss.deleteSheet(temp);

    const result = {
      phase: "RESET_DONE",
      ok: true,
      deletedSheets: deleted,
      createdSheets: createdSheets.concat([exportLogName]),
      tokenCleared: true
    };
    props.deleteProperty("BELLE_RESET_TOKEN");
    Logger.log(result);
    return result;
  } finally {
    if (lock) lock.releaseLock();
  }
}

function belle_resetSpreadsheetToInitialState_fallback_v0_test() {
  return belle_resetSpreadsheetToInitialState_fallback_v0();
}


