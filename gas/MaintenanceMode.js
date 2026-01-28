// @ts-check

// NOTE: Keep comments ASCII only.

var BELLE_DASHBOARD_MODE_KEY_ = "BELLE_DASHBOARD_MODE";
var BELLE_DASHBOARD_MAINT_UNTIL_KEY_ = "BELLE_DASHBOARD_MAINT_UNTIL_ISO";

function belle_maint_getTtlMinutes_() {
  var props = belle_cfg_getProps_();
  var raw = props.getProperty("BELLE_MAINTENANCE_TTL_MINUTES");
  var n = Number(raw);
  if (isNaN(n) || n <= 0) return 30;
  return Math.floor(n);
}

function belle_maint_getState_() {
  var props = belle_cfg_getProps_();
  var modeRaw = String(props.getProperty(BELLE_DASHBOARD_MODE_KEY_) || "OCR").toUpperCase();
  var mode = modeRaw === "MAINTENANCE" ? "MAINTENANCE" : "OCR";
  var untilIso = String(props.getProperty(BELLE_DASHBOARD_MAINT_UNTIL_KEY_) || "");
  var nowMs = Date.now();
  var expired = false;
  if (mode === "MAINTENANCE") {
    var untilMs = Date.parse(untilIso || "");
    if (!untilIso || isNaN(untilMs) || nowMs > untilMs) {
      mode = "OCR";
      expired = true;
      props.setProperty(BELLE_DASHBOARD_MODE_KEY_, "OCR");
      props.deleteProperty(BELLE_DASHBOARD_MAINT_UNTIL_KEY_);
      untilIso = "";
    }
  }
  return {
    mode: mode,
    untilIso: untilIso,
    expired: expired,
    nowIso: new Date(nowMs).toISOString()
  };
}

function belle_maint_getStateResult_() {
  var state = belle_maint_getState_();
  return {
    ok: true,
    reason: "OK",
    message: "Mode ready.",
    data: {
      mode: state.mode,
      until_iso: state.untilIso,
      expired: state.expired === true
    }
  };
}

function belle_maint_requireMode_(expected) {
  var want = String(expected || "").toUpperCase();
  if (want !== "MAINTENANCE") want = "OCR";
  var state = belle_maint_getState_();
  if (state.mode !== want) {
    return {
      ok: false,
      reason: "MODE_NOT_" + want,
      message: "Mode must be " + want + ".",
      data: {
        mode: state.mode,
        until_iso: state.untilIso
      }
    };
  }
  return {
    ok: true,
    reason: "OK",
    message: "OK",
    data: {
      mode: state.mode,
      until_iso: state.untilIso
    }
  };
}

function belle_maint_setMode_(mode, untilIso) {
  var props = belle_cfg_getProps_();
  var m = String(mode || "").toUpperCase() === "MAINTENANCE" ? "MAINTENANCE" : "OCR";
  props.setProperty(BELLE_DASHBOARD_MODE_KEY_, m);
  if (m === "MAINTENANCE") {
    props.setProperty(BELLE_DASHBOARD_MAINT_UNTIL_KEY_, String(untilIso || ""));
  } else {
    props.deleteProperty(BELLE_DASHBOARD_MAINT_UNTIL_KEY_);
  }
}

function belle_maint_checkNoLiveProcessing_() {
  var props = belle_cfg_getProps_();
  var sheetId = belle_cfg_getSheetIdOrEmpty_(props);
  if (!sheetId) {
    return { ok: false, reason: "MISSING_SHEET_ID", message: "Missing BELLE_SHEET_ID.", data: null };
  }
  var ss = SpreadsheetApp.openById(sheetId);
  var nowMs = Date.now();
  var docTypes = [BELLE_DOC_TYPE_RECEIPT, BELLE_DOC_TYPE_CC_STATEMENT, BELLE_DOC_TYPE_BANK_STATEMENT];
  for (var i = 0; i < docTypes.length; i++) {
    var sheetName = belle_ocr_getQueueSheetNameForDocType_(props, docTypes[i]);
    var sh = ss.getSheetByName(sheetName);
    if (!sh) continue;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    var lastCol = sh.getLastColumn();
    var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var map = {};
    for (var h = 0; h < header.length; h++) {
      map[String(header[h] || "")] = h;
    }
    if (map.status === undefined || map.ocr_lock_until_iso === undefined) {
      return {
        ok: false,
        reason: "INVALID_QUEUE_HEADER",
        message: "Missing required columns.",
        data: { sheet: sheetName }
      };
    }
    var rowCount = lastRow - 1;
    var statusVals = sh.getRange(2, map.status + 1, rowCount, 1).getValues();
    var lockVals = sh.getRange(2, map.ocr_lock_until_iso + 1, rowCount, 1).getValues();
    for (var r = 0; r < rowCount; r++) {
      var status = String(statusVals[r][0] || "");
      if (status !== "PROCESSING") continue;
      var lockIso = String(lockVals[r][0] || "");
      var lockMs = Date.parse(lockIso);
      if (!isNaN(lockMs) && lockMs > nowMs) {
        return {
          ok: false,
          reason: "LIVE_PROCESSING",
          message: "Processing still active.",
          data: { sheet: sheetName }
        };
      }
    }
  }
  return { ok: true, reason: "OK", message: "No live processing.", data: null };
}

function belle_maint_hasOcrTriggers_() {
  if (typeof belle_ocr_parallel_getTriggersByHandler_ === "function") {
    var triggers = belle_ocr_parallel_getTriggersByHandler_("belle_ocr_workerTick");
    return triggers && triggers.length > 0;
  }
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction && all[i].getHandlerFunction() === "belle_ocr_workerTick") return true;
  }
  return false;
}

function belle_maint_quiesceAndEnter_() {
  var state = belle_maint_getState_();
  if (state.mode === "MAINTENANCE") {
    return {
      ok: false,
      reason: "ALREADY_MAINTENANCE",
      message: "Already in maintenance mode.",
      data: { mode: state.mode, until_iso: state.untilIso }
    };
  }
  var lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
  } catch (e) {
    return { ok: false, reason: "LOCK_BUSY", message: "Script lock busy.", data: null };
  }
  try {
    if (belle_maint_hasOcrTriggers_()) {
      return {
        ok: false,
        reason: "TRIGGERS_ACTIVE",
        message: "Disable OCR triggers before entering maintenance.",
        data: { mode: state.mode, until_iso: state.untilIso }
      };
    }
    var liveCheck = belle_maint_checkNoLiveProcessing_();
    if (!liveCheck.ok) return liveCheck;
    var ttlMinutes = belle_maint_getTtlMinutes_();
    var untilIso = new Date(Date.now() + ttlMinutes * 60000).toISOString();
    belle_maint_setMode_("MAINTENANCE", untilIso);
    return {
      ok: true,
      reason: "OK",
      message: "Maintenance mode enabled.",
      data: {
        mode: "MAINTENANCE",
        until_iso: untilIso,
        ttl_minutes: ttlMinutes
      }
    };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function belle_maint_exit_() {
  belle_maint_setMode_("OCR", "");
  return {
    ok: true,
    reason: "OK",
    message: "Maintenance mode disabled.",
    data: { mode: "OCR", until_iso: "" }
  };
}
