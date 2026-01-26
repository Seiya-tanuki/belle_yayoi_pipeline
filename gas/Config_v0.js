// @ts-check

// NOTE: Keep comments ASCII only.

function belle_cfg_getProps_() {
  return PropertiesService.getScriptProperties();
}

function belle_cfg_getString_(props, key, opts) {
  const p = props || belle_cfg_getProps_();
  const options = opts || {};
  const required = options.required === true;
  const trim = options.trim === true;
  const defaultValue = options.defaultValue;
  let raw = p.getProperty(key);
  if (raw === null || raw === undefined) raw = "";
  let value = String(raw);
  if (trim) value = value.trim();
  if (!value) {
    if (required) throw new Error("Missing Script Property: " + key);
    if (defaultValue !== undefined) return String(defaultValue);
    return "";
  }
  return value;
}

function belle_cfg_getNumber_(props, key, opts) {
  const p = props || belle_cfg_getProps_();
  const options = opts || {};
  const required = options.required === true;
  const defaultValue = options.defaultValue;
  const raw = p.getProperty(key);
  if (raw === null || raw === undefined || raw === "") {
    if (required) throw new Error("Missing Script Property: " + key);
    if (defaultValue !== undefined) return Number(defaultValue);
    return NaN;
  }
  const num = Number(raw);
  if (isNaN(num)) {
    if (required) throw new Error("Invalid Script Property number: " + key);
    if (defaultValue !== undefined) return Number(defaultValue);
    return NaN;
  }
  return num;
}

function belle_cfg_getBool_(props, key, opts) {
  const p = props || belle_cfg_getProps_();
  const options = opts || {};
  const required = options.required === true;
  const defaultValue = options.defaultValue;
  const raw = p.getProperty(key);
  if (raw === null || raw === undefined || raw === "") {
    if (required) throw new Error("Missing Script Property: " + key);
    return defaultValue !== undefined ? !!defaultValue : false;
  }
  const s = String(raw).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  if (required) throw new Error("Invalid Script Property boolean: " + key);
  return defaultValue !== undefined ? !!defaultValue : false;
}

function belle_cfg_getJson_(props, key, opts) {
  const p = props || belle_cfg_getProps_();
  const options = opts || {};
  const required = options.required === true;
  const defaultValue = options.defaultValue;
  const raw = p.getProperty(key);
  if (raw === null || raw === undefined || raw === "") {
    if (required) throw new Error("Missing Script Property: " + key);
    return defaultValue;
  }
  try {
    return JSON.parse(String(raw));
  } catch (e) {
    if (required) throw new Error("Invalid Script Property JSON: " + key);
    return defaultValue;
  }
}

function belle_cfg_getSheetIdOrThrow_(props) {
  return belle_cfg_getString_(props, "BELLE_SHEET_ID", { required: true });
}

function belle_cfg_getSheetIdOrEmpty_(props) {
  return belle_cfg_getString_(props, "BELLE_SHEET_ID", { required: false, defaultValue: "" });
}

function belle_cfg_getDriveFolderIdOrThrow_(props) {
  return belle_cfg_getString_(props, "BELLE_DRIVE_FOLDER_ID", { required: true });
}

function belle_cfg_getOutputFolderIdOrDriveFolderId_(props) {
  const p = props || belle_cfg_getProps_();
  const outputId = belle_cfg_getString_(p, "BELLE_OUTPUT_FOLDER_ID", { required: false, defaultValue: "" });
  if (outputId) return outputId;
  return belle_cfg_getString_(p, "BELLE_DRIVE_FOLDER_ID", { required: false, defaultValue: "" });
}

function belle_cfg_getOutputFolderIdOrDriveFolderIdOrThrow_(props) {
  const value = belle_cfg_getOutputFolderIdOrDriveFolderId_(props);
  if (!value) throw new Error("Missing Script Property: BELLE_OUTPUT_FOLDER_ID (or BELLE_DRIVE_FOLDER_ID)");
  return value;
}

function belle_cfg_getQueueSheetNameOverride_(props) {
  return belle_cfg_getString_(props, "BELLE_QUEUE_SHEET_NAME", { required: false, defaultValue: "" });
}

function belle_cfg_getLegacyQueueSheetNameOverride_(props) {
  return belle_cfg_getString_(props, "BELLE_SHEET_NAME", { required: false, defaultValue: "" });
}

function belle_cfg_getSkipLogSheetName_(props) {
  return belle_cfg_getString_(props, "BELLE_SKIP_LOG_SHEET_NAME", { required: false, defaultValue: "EXPORT_SKIP_LOG" });
}

function belle_cfg_getQueueSkipLogSheetName_(props) {
  return belle_cfg_getString_(props, "BELLE_QUEUE_SKIP_LOG_SHEET_NAME", { required: false, defaultValue: "QUEUE_SKIP_LOG" });
}

function belle_cfg_getExportGuardLogSheetName_(props) {
  return belle_cfg_getString_(props, "BELLE_EXPORT_GUARD_LOG_SHEET_NAME", { required: false, defaultValue: "EXPORT_GUARD_LOG" });
}

function belle_cfg_getBankStage2GenCfgOverride_(props) {
  const p = props || belle_cfg_getProps_();
  const key = "BELLE_BANK_STAGE2_GENCFG_JSON";
  const raw = p.getProperty(key);
  if (raw === null || raw === undefined || raw === "") return null;
  const sentinel = { __invalid: true };
  const parsed = belle_cfg_getJson_(p, key, { required: false, defaultValue: sentinel });
  if (parsed === sentinel) {
    if (typeof belle_configWarnOnce === "function") {
      belle_configWarnOnce("BELLE_BANK_STAGE2_GENCFG_JSON_INVALID", "Invalid JSON for " + key);
    }
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    if (typeof belle_configWarnOnce === "function") {
      belle_configWarnOnce("BELLE_BANK_STAGE2_GENCFG_JSON_INVALID", "JSON must be an object for " + key);
    }
    return null;
  }
  return parsed;
}

function belle_cfg_getQueueSheetNameForDocType_(props, docType) {
  const p = props || belle_cfg_getProps_();
  const key = String(docType || BELLE_DOC_TYPE_RECEIPT);
  if (key === BELLE_DOC_TYPE_RECEIPT) {
    const name = belle_cfg_getQueueSheetNameOverride_(p);
    if (name) return name;
    const legacy = belle_cfg_getLegacyQueueSheetNameOverride_(p);
    if (legacy) {
      if (typeof belle_configWarnOnce === "function") {
        belle_configWarnOnce("BELLE_SHEET_NAME_DEPRECATED", "Use BELLE_QUEUE_SHEET_NAME instead.");
      }
      return legacy;
    }
  }
  return belle_ocr_getFixedQueueSheetNameForDocType_(key);
}

function belle_cfg_getOcrClaimCursorRaw_(props, docType, cursorKey) {
  const p = props || belle_cfg_getProps_();
  const key = String(cursorKey || "");
  const raw = belle_cfg_getString_(p, key, { required: false, defaultValue: "" });
  if (raw) return raw;
  if (String(docType || "") === BELLE_DOC_TYPE_RECEIPT) {
    return belle_cfg_getString_(p, "BELLE_OCR_CLAIM_CURSOR", { required: false, defaultValue: "" });
  }
  return "";
}

function belle_configWarnOnce(key, detail) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = "CFG_WARN_" + String(key || "");
    if (cache.get(cacheKey)) return;
    cache.put(cacheKey, "1", 3600);
  } catch (e) {
    // ignore cache errors
  }
  try {
    Logger.log({ phase: "CONFIG_WARN", ok: true, key: String(key || ""), detail: String(detail || "") });
  } catch (e) {
    // ignore logger errors
  }
}

function belle_parseBool(value, defaultValue) {
  const raw = String(value || "").trim();
  if (!raw) return defaultValue === undefined ? false : !!defaultValue;
  const lower = raw.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes" || lower === "y") return true;
  if (lower === "false" || lower === "0" || lower === "no" || lower === "n") return false;
  return defaultValue === undefined ? false : !!defaultValue;
}

function belle_getQueueSheetName(props) {
  return belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_RECEIPT);
}

function belle_getOutputFolderId(props) {
  const p = props || belle_cfg_getProps_();
  return String(p.getProperty("BELLE_OUTPUT_FOLDER_ID") || p.getProperty("BELLE_DRIVE_FOLDER_ID") || "");
}
