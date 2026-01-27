// NOTE: Keep comments ASCII only.

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
  const props = belle_cfg_getProps_();
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
function belle_callGeminiOcr(imageBlob, opt) {
  const cfg = belle_getGeminiConfig();
  const defaultPrompt = (typeof BELLE_OCR_PROMPT_V0 !== "undefined") ? BELLE_OCR_PROMPT_V0 : "";
  const prompt = (opt && opt.promptText) ? String(opt.promptText) : defaultPrompt;
  if (!prompt) throw new Error("Missing OCR prompt constant: BELLE_OCR_PROMPT_V0");

  const mimeType = imageBlob.getContentType();
  const b64 = Utilities.base64Encode(imageBlob.getBytes());
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(cfg.model) + ":generateContent?key=" + encodeURIComponent(cfg.apiKey);
  const baseTemp = (opt && typeof opt.temperature === "number" && !isNaN(opt.temperature))
    ? belle_ocr_clampTemperature_(opt.temperature)
    : 0.0;
  const responseMimeType = opt && opt.responseMimeType ? String(opt.responseMimeType) : "";
  const responseJsonSchema = opt && opt.responseJsonSchema ? opt.responseJsonSchema : null;
  const generationConfigOverride = opt && opt.generationConfig ? opt.generationConfig : null;

  const generationConfig = { temperature: baseTemp };
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
  const finalTemp = generationConfig.temperature;
  if (typeof finalTemp === "number" && !isNaN(finalTemp)) {
    generationConfig.temperature = belle_ocr_clampTemperature_(finalTemp);
  } else {
    generationConfig.temperature = baseTemp;
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

function belle_ocr_clampTemperature_(value) {
  const n = Number(value);
  if (isNaN(n)) return 0.0;
  if (n < 0) return 0.0;
  if (n > 2) return 2.0;
  return n;
}

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

function belle_ocr_cc_classifyStage1Page_(pageType) {
  const t = String(pageType || "");
  if (t === "transactions") {
    return { proceed: true, statusOut: "", errorCode: "", errorMessage: "" };
  }
  if (t === "non_transactions") {
    return {
      proceed: false,
      statusOut: "ERROR_FINAL",
      errorCode: "CC_NON_TRANSACTION_PAGE",
      errorMessage: BELLE_DOC_TYPE_CC_STATEMENT + " page_type=non_transactions"
    };
  }
  return {
    proceed: false,
    statusOut: "ERROR_RETRYABLE",
    errorCode: "CC_PAGE_UNKNOWN",
    errorMessage: BELLE_DOC_TYPE_CC_STATEMENT + " page_type=unknown"
  };
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
      clearNextRetry: true
    };
  }
  return {
    statusOut: decision.statusOut,
    errorCode: decision.errorCode,
    errorMessage: decision.errorMessage,
    errorDetail: belle_ocr_buildInvalidSchemaLogDetail_(stage1JsonStr),
    cacheJson: "",
    clearErrors: false,
    clearNextRetry: decision.statusOut !== "ERROR_RETRYABLE"
  };
}

function belle_ocr_cc_buildStage2SuccessWriteback_(stage2JsonStr) {
  return {
    statusOut: "DONE",
    errorCode: "",
    errorMessage: "",
    errorDetail: "",
    nextJson: stage2JsonStr,
    clearErrors: true
  };
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
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {
    // ignore invalid json
  }
  return fallback;
}

function belle_ocr_cc_mergeGenCfg_(baseCfg, overrideCfg) {
  const base = (baseCfg && typeof baseCfg === "object") ? baseCfg : {};
  const override = (overrideCfg && typeof overrideCfg === "object") ? overrideCfg : null;
  if (!override) return base;
  const merged = {};
  const keys = Object.keys(base);
  for (let i = 0; i < keys.length; i++) {
    merged[keys[i]] = base[keys[i]];
  }
  const okeys = Object.keys(override);
  for (let j = 0; j < okeys.length; j++) {
    merged[okeys[j]] = override[okeys[j]];
  }
  return merged;
}

function belle_ocr_cc_getStage1GenCfg_(props) {
  const p = props || belle_cfg_getProps_();
  const defaults = {
    topP: 0.1,
    maxOutputTokens: 512,
    thinkingConfig: { thinkingLevel: "low" }
  };
  const override = belle_cfg_getOcrGenCfgOverride_(p, "cc_statement", "stage1");
  return belle_ocr_cc_mergeGenCfg_(defaults, override);
}

function belle_ocr_cc_getStage2GenCfg_(props) {
  const p = props || belle_cfg_getProps_();
  const defaults = {
    topP: 0.1,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingLevel: "low" }
  };
  const override = belle_cfg_getOcrGenCfgOverride_(p, "cc_statement", "stage2");
  return belle_ocr_cc_mergeGenCfg_(defaults, override);
}

function belle_ocr_cc_enableResponseJsonSchema_(props) {
  const p = props || belle_cfg_getProps_();
  return belle_parseBool(p.getProperty("BELLE_CC_ENABLE_RESPONSE_JSON_SCHEMA"), false);
}

function belle_ocr_cc_enableResponseMimeType_(props) {
  const p = props || belle_cfg_getProps_();
  return belle_parseBool(p.getProperty("BELLE_CC_ENABLE_RESPONSE_MIME_TYPE"), false);
}

function belle_ocr_cc_getStage1ResponseJsonSchema_() {
  return {
    type: "object",
    required: ["task", "page_type", "reason_codes", "page_issues"],
    additionalProperties: false,
    properties: {
      task: { type: "string", enum: ["page_classification"] },
      page_type: { type: "string", enum: ["transactions", "non_transactions", "unknown"] },
      reason_codes: { type: "array", items: { type: "string" } },
      page_issues: { type: "array", items: { type: "string" } }
    }
  };
}

function belle_ocr_cc_getStage2ResponseJsonSchema_() {
  return {
    type: "object",
    required: ["task", "transactions"],
    additionalProperties: false,
    properties: {
      task: { type: "string", enum: ["transaction_extraction"] },
      transactions: {
        type: "array",
        items: {
          type: "object",
          required: ["row_no", "raw_use_date_text", "use_month", "use_day", "merchant", "amount_yen", "amount_sign", "issues"],
          additionalProperties: false,
          properties: {
            row_no: { type: "number" },
            raw_use_date_text: { type: "string" },
            use_month: { type: "number" },
            use_day: { type: "number" },
            merchant: { type: "string" },
            amount_yen: { type: "number" },
            amount_sign: { type: "string", enum: ["debit", "credit"] },
            issues: { type: "array", items: { type: "string" } }
          }
        }
      }
    }
  };
}

function belle_ocr_buildInvalidSchemaLogDetail_(jsonStr) {
  const raw = String(jsonStr || "");
  const maxChars = 45000;
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;
  return raw.slice(0, maxChars);
}

function belle_ocr_classifyError(message) {
  const msg = String(message || "").toLowerCase();
  const retryable = [
    "timed out",
    "timeout",
    "service unavailable",
    "rate limit",
    "quota",
    "exceeded",
    "too many requests",
    "503",
    "500",
    "502",
    "504",
    "429"
  ];
  for (let i = 0; i < retryable.length; i++) {
    if (msg.indexOf(retryable[i]) >= 0) {
      return { retryable: true, reason: retryable[i] };
    }
  }
  return { retryable: false, reason: "" };
}
