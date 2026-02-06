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

function belle_cfg_getSkipLogSheetName_(props) {
  return belle_cfg_getString_(props, "BELLE_SKIP_LOG_SHEET_NAME", { required: false, defaultValue: "EXPORT_SKIP_LOG" });
}

function belle_cfg_getQueueSkipLogSheetName_(props) {
  return belle_cfg_getString_(props, "BELLE_QUEUE_SKIP_LOG_SHEET_NAME", { required: false, defaultValue: "QUEUE_SKIP_LOG" });
}

function belle_cfg_getExportGuardLogSheetName_(props) {
  return belle_cfg_getString_(props, "BELLE_EXPORT_GUARD_LOG_SHEET_NAME", { required: false, defaultValue: "EXPORT_GUARD_LOG" });
}

function belle_cfg_getOcrGenCfgOverride_(props, docType, stage) {
  const p = props || belle_cfg_getProps_();
  const typeKey = String(docType || "");
  const stageKey = String(stage || "");
  const key = "BELLE_OCR_GENCFG_JSON__" + typeKey + "__" + stageKey;

  function isPlainObject_(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  const raw = p.getProperty(key);
  if (raw === null || raw === undefined || raw === "") return null;
  const sentinel = { __invalid: true };
  const parsed = belle_cfg_getJson_(p, key, { required: false, defaultValue: sentinel });
  if (parsed === sentinel) {
    if (typeof belle_configWarnOnce === "function") {
      belle_configWarnOnce("BELLE_OCR_GENCFG_JSON_INVALID__" + typeKey + "__" + stageKey, "Invalid JSON for " + key);
    }
    return null;
  }
  if (!isPlainObject_(parsed)) {
    if (typeof belle_configWarnOnce === "function") {
      belle_configWarnOnce("BELLE_OCR_GENCFG_JSON_INVALID__" + typeKey + "__" + stageKey, "JSON must be an object for " + key);
    }
    return null;
  }
  return parsed;
}

function belle_cfg_getBankStage2GenCfgOverride_(props) {
  return belle_cfg_getOcrGenCfgOverride_(props, "bank_statement", "stage1");
}

function belle_cfg_getQueueSheetNameForDocType_(props, docType) {
  const key = String(docType || BELLE_DOC_TYPE_RECEIPT);
  return belle_ocr_getFixedQueueSheetNameForDocType_(key);
}

function belle_cfg_getOcrClaimCursorRaw_(props, docType, cursorKey) {
  const p = props || belle_cfg_getProps_();
  const key = String(cursorKey || "");
  const raw = belle_cfg_getString_(p, key, { required: false, defaultValue: "" });
  if (raw) return raw;
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

function belle_corr_toText_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function belle_corr_composeActionKey_(action, rid) {
  const actionText = belle_corr_toText_(action);
  const ridText = belle_corr_toText_(rid);
  if (!actionText || !ridText) return "";
  return actionText + "::" + ridText;
}

function belle_corr_composeItemKey_(docType, fileId) {
  const docTypeText = belle_corr_toText_(docType);
  const fileIdText = belle_corr_toText_(fileId);
  if (!docTypeText || !fileIdText) return "";
  return docTypeText + "::" + fileIdText;
}

function belle_corr_isItemKeyFormat_(value) {
  const s = belle_corr_toText_(value);
  if (!s) return false;
  const sep = s.indexOf("::");
  if (sep <= 0) return false;
  if (sep >= s.length - 2) return false;
  return s.indexOf("::", sep + 2) < 0;
}

function belle_corr_parseItemKey_(value) {
  const s = belle_corr_toText_(value);
  if (!belle_corr_isItemKeyFormat_(s)) {
    return { ok: false, doc_type: "", file_id: "" };
  }
  const sep = s.indexOf("::");
  return {
    ok: true,
    doc_type: s.slice(0, sep),
    file_id: s.slice(sep + 2)
  };
}

function belle_corr_getReadMode_(props) {
  const p = props || belle_cfg_getProps_();
  const raw = belle_cfg_getString_(p, "BELLE_X1_CORRELATION_READ_MODE", {
    required: false,
    trim: true,
    defaultValue: "compatibility"
  });
  const normalized = String(raw || "").toLowerCase();
  if (normalized === "normalized_first" || normalized === "normalized-first" || normalized === "normalized") {
    return "normalized_first";
  }
  return "compatibility";
}

function belle_corr_resolveItemKey_(input, opts) {
  const source = input && typeof input === "object" ? input : {};
  const options = opts && typeof opts === "object" ? opts : {};
  const props = options.props || belle_cfg_getProps_();
  const readMode = options.mode ? String(options.mode) : belle_corr_getReadMode_(props);
  const mode = readMode === "normalized_first" ? "normalized_first" : "compatibility";
  const docType = belle_corr_toText_(source.doc_type || source.docType);
  const fileId = belle_corr_toText_(source.file_id || source.fileId);
  const providedCorrKey = belle_corr_toText_(source.corr_key || source.corrKey);
  const providedValid = belle_corr_isItemKeyFormat_(providedCorrKey);
  const legacyCorrKey = belle_corr_composeItemKey_(docType, fileId);

  let corrKey = "";
  let missing = false;
  let invalidFormat = false;
  let derivedFromLegacy = false;
  let mismatch = false;

  if (mode === "normalized_first") {
    if (providedCorrKey && providedValid) {
      corrKey = providedCorrKey;
    } else if (legacyCorrKey) {
      corrKey = legacyCorrKey;
      derivedFromLegacy = true;
      if (providedCorrKey && !providedValid) invalidFormat = true;
    } else {
      if (providedCorrKey && !providedValid) invalidFormat = true;
      missing = true;
    }
  } else {
    if (legacyCorrKey) {
      corrKey = legacyCorrKey;
      if (!providedCorrKey || !providedValid || providedCorrKey !== legacyCorrKey) {
        derivedFromLegacy = true;
      }
      if (providedCorrKey && !providedValid) invalidFormat = true;
    } else if (providedCorrKey && providedValid) {
      corrKey = providedCorrKey;
    } else {
      if (providedCorrKey && !providedValid) invalidFormat = true;
      missing = true;
    }
  }

  if (legacyCorrKey && corrKey && legacyCorrKey !== corrKey) {
    mismatch = true;
  }

  return {
    mode: mode,
    corr_key: corrKey,
    doc_type: docType,
    file_id: fileId,
    missing: missing,
    invalid_format: invalidFormat,
    derived_from_legacy: derivedFromLegacy,
    mismatch: mismatch
  };
}

function belle_corr_createCounters_() {
  return {
    missing: 0,
    invalid: 0,
    derived: 0,
    mismatch: 0
  };
}

function belle_corr_countResolved_(counters, resolved) {
  const out = counters && typeof counters === "object" ? counters : belle_corr_createCounters_();
  const value = resolved && typeof resolved === "object" ? resolved : null;
  if (!value) return out;
  if (value.missing) out.missing++;
  if (value.invalid_format) out.invalid++;
  if (value.derived_from_legacy) out.derived++;
  if (value.mismatch) out.mismatch++;
  return out;
}

function belle_corr_emitSignal_(signal, payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const row = { phase: String(signal || "X1_CORR"), ok: true };
  const keys = Object.keys(data);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    row[key] = data[key];
  }
  Logger.log(row);
  return row;
}

function belle_corr_observeItem_(signal, counters, input, opts) {
  const source = input && typeof input === "object" ? input : {};
  const resolved = belle_corr_resolveItemKey_(source, opts);
  belle_corr_countResolved_(counters, resolved);
  const event = {
    doc_type: source.doc_type !== undefined ? source.doc_type : source.docType,
    file_id: source.file_id !== undefined ? source.file_id : source.fileId,
    corr_key: resolved.corr_key,
    corr_action_key: source.corr_action_key || source.corrActionKey || "",
    rid: source.rid || "",
    action: source.action || "",
    queue_sheet_name: source.queue_sheet_name || source.queueSheetName || "",
    rowIndex: source.rowIndex !== undefined ? source.rowIndex : "",
    mode: resolved.mode,
    missing: resolved.missing,
    invalid: resolved.invalid_format,
    derived: resolved.derived_from_legacy,
    mismatch: resolved.mismatch
  };
  belle_corr_emitSignal_(signal, event);
  return resolved;
}
