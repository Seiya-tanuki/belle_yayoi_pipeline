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
