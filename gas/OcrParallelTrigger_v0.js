// @ts-check

// NOTE: Keep comments ASCII only.

const BELLE_TRIGGER_AUDIT_REMOVED_HANDLERS_ = [
  "belle_queueFolderFilesToSheet_test",
  "belle_processQueueOnce_test",
  "belle_ocr_claimNextRow_fallback_v0_test",
  "belle_runPipelineBatch_v0_test",
  "belle_resetSpreadsheetToInitialState_fallback_v0_test",
  "belle_exportYayoiCsvFromReview_test",
  "belle_ocr_workerLoop_fallback_v0_test",
  "belle_ocr_parallel_smoke_test",
  "belle_ocr_parallel_enable_fallback_v0_test",
  "belle_ocr_parallel_disable_fallback_v0_test",
  "belle_ocr_parallel_status_fallback_v0_test",
  "belle_chatwork_webhook_mock_test",
  "belle_chatworkSendTestMessage_v0_test",
  "belle_chatwork_sendLatestCsv_test"
];

function belle_triggerAudit_isRemovedHandler_(handler) {
  const name = String(handler || "");
  if (!name) return false;
  if (name.slice(-5) === "_test") return true;
  return BELLE_TRIGGER_AUDIT_REMOVED_HANDLERS_.indexOf(name) >= 0;
}

function belle_triggerAudit_run_(opts) {
  const options = opts || {};
  const triggers = ScriptApp.getProjectTriggers();
  const details = [];
  const removed = [];
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    const handler = t.getHandlerFunction ? t.getHandlerFunction() : "";
    const eventType = t.getEventType ? String(t.getEventType()) : "";
    const triggerId = t.getUniqueId ? t.getUniqueId() : "";
    details.push({ id: triggerId, eventType: eventType, handler: handler });
    if (belle_triggerAudit_isRemovedHandler_(handler)) {
      ScriptApp.deleteTrigger(t);
      removed.push({ id: triggerId, eventType: eventType, handler: handler });
    }
  }
  Logger.log({ phase: "TRIGGER_AUDIT_DETAILS", ok: true, triggers: details });
  const res = {
    phase: "TRIGGER_AUDIT",
    ok: true,
    total: triggers.length,
    removedCount: removed.length,
    removedHandlers: removed
  };
  Logger.log(res);
  return res;
}

function belle_triggerAuditOnly_v0() {
  return belle_triggerAudit_run_({ remove: true });
}

function belle_ocr_parallel_getTag_(props) {
  return props.getProperty("BELLE_OCR_PARALLEL_TRIGGER_TAG") || "BELLE_OCR_PARALLEL_V0";
}

function belle_ocr_parallel_getWorkerCount_(props) {
  const raw = props.getProperty("BELLE_OCR_PARALLEL_WORKERS") || "1";
  const n = Number(raw);
  if (isNaN(n)) return null;
  return Math.floor(n);
}

function belle_ocr_parallel_parseTriggerIds_(props) {
  const idsRaw = props.getProperty("BELLE_OCR_PARALLEL_TRIGGER_IDS") || "[]";
  let ids = [];
  try {
    ids = JSON.parse(idsRaw);
    if (!Array.isArray(ids)) ids = [];
  } catch (e) {
    ids = [];
  }
  return ids;
}

function belle_ocr_parallel_clampWindowMs_(value) {
  if (value === null || value === undefined || value === "") return 50000;
  const n = Number(value);
  if (isNaN(n)) return 50000;
  if (n < 0) return 0;
  if (n > 59000) return 59000;
  return Math.floor(n);
}

function belle_ocr_parallel_computeStaggerMs_(workerCount, windowMs, slot) {
  const count = Math.floor(Number(workerCount) || 0);
  if (count <= 0) return 0;
  const window = belle_ocr_parallel_clampWindowMs_(windowMs);
  let normalized = Math.floor(Number(slot) || 0);
  if (normalized < 0) normalized = 0;
  normalized = normalized % count;
  const interval = Math.floor(window / count);
  if (!interval || interval <= 0) return 0;
  return interval * normalized;
}

function belle_ocr_parallel_hashSlot_(triggerUid, workerCount) {
  const count = Math.floor(Number(workerCount) || 0);
  if (count <= 0) return 0;
  const s = String(triggerUid || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0) % count;
}

function belle_ocr_parallel_resolveStaggerSlot_(triggerUid, triggerIds, workerCount) {
  const count = Math.floor(Number(workerCount) || 0);
  if (count <= 0) return 0;
  const uid = String(triggerUid || "");
  if (uid && Array.isArray(triggerIds)) {
    const idx = triggerIds.indexOf(uid);
    if (idx >= 0) return idx % count;
  }
  return belle_ocr_parallel_hashSlot_(uid, count);
}

function belle_ocr_parallel_resolveStaggerWindowMs_(props) {
  const raw = props.getProperty("BELLE_OCR_PARALLEL_STAGGER_WINDOW_MS");
  return belle_ocr_parallel_clampWindowMs_(raw);
}

function belle_ocr_parallel_getTriggersByIds_(ids) {
  const byId = {};
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    byId[t.getUniqueId()] = t;
  }
  const found = [];
  for (let i = 0; i < ids.length; i++) {
    const t = byId[ids[i]];
    if (t) found.push(t);
  }
  return found;
}

function belle_ocr_parallel_getTriggersByHandler_(handlerName) {
  const triggers = ScriptApp.getProjectTriggers();
  const out = [];
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handlerName) out.push(triggers[i]);
  }
  return out;
}

function belle_ocr_workerTick_fallback_v0(e) {
  const props = belle_cfg_getProps_();
  const enabled = belle_parseBool(props.getProperty("BELLE_OCR_PARALLEL_ENABLED"), false);
  if (!enabled) {
    const guard = { phase: "OCR_PARALLEL_GUARD", ok: true, reason: "PARALLEL_DISABLED" };
    Logger.log(guard);
    return guard;
  }

  const triggerUid = e && e.triggerUid ? String(e.triggerUid) : "";
  let workerCount = belle_ocr_parallel_getWorkerCount_(props);
  if (!workerCount || workerCount < 1) workerCount = 1;
  const docTypes = belle_ocr_getActiveDocTypes_(props);
  const triggerIds = belle_ocr_parallel_parseTriggerIds_(props);
  const workerSlot = belle_ocr_parallel_resolveStaggerSlot_(triggerUid, triggerIds, workerCount);
  const staggerWindowMs = belle_ocr_parallel_resolveStaggerWindowMs_(props);
  const staggerMs = belle_ocr_parallel_computeStaggerMs_(workerCount, staggerWindowMs, workerSlot);
  if (staggerMs > 0) Utilities.sleep(staggerMs);

  const workerId = Utilities.getUuid();
  const result = belle_ocr_workerLoop_fallback_v0_({ workerId: workerId, maxItems: 1, lockMode: "try", lockWaitMs: 500, docTypes: docTypes });
  try {
    belle_ocr_perf_appendFromSummary_(result);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    Logger.log({ phase: "OCR_PARALLEL_PERF_LOG_ERROR", ok: false, message: msg });
  }
  if (result && result.lastReason === "LOCK_BUSY") {
    const guard = { phase: "OCR_PARALLEL_GUARD", ok: true, reason: "LOCK_BUSY" };
    Logger.log(guard);
    return guard;
  }
  const res = {
    phase: "OCR_PARALLEL_TICK",
    workerId: workerId,
    ok: result && result.ok !== false,
    processed: result && result.processed ? result.processed : 0,
    done: result && result.done ? result.done : 0,
    errors: result && result.errors ? result.errors : 0,
    lockBusySkipped: result && result.lockBusySkipped ? result.lockBusySkipped : 0,
    workerCount: workerCount,
    workerSlot: workerSlot,
    staggerMs: staggerMs,
    triggerUid: triggerUid,
    docType: result && result.docType ? result.docType : "",
    docTypes: docTypes
  };
  Logger.log(res);
  return res;
}

function belle_ocr_parallel_enable_fallback_v0() {
  const props = belle_cfg_getProps_();
  const requested = belle_ocr_parallel_getWorkerCount_(props);
  if (!requested || requested < 1 || requested > 20) {
    const guard = { phase: "OCR_PARALLEL_ENABLE", ok: true, reason: "INVALID_WORKER_COUNT", requested: requested };
    Logger.log(guard);
    return guard;
  }

  const tag = belle_ocr_parallel_getTag_(props);
  const ids = belle_ocr_parallel_parseTriggerIds_(props);

  const handlerName = "belle_ocr_workerTick_fallback_v0";
  const existingById = belle_ocr_parallel_getTriggersByIds_(ids);
  const existingByHandler = belle_ocr_parallel_getTriggersByHandler_(handlerName);
  let deletedOld = 0;
  for (let i = 0; i < existingById.length; i++) {
    ScriptApp.deleteTrigger(existingById[i]);
    deletedOld++;
  }
  for (let i = 0; i < existingByHandler.length; i++) {
    if (existingById.indexOf(existingByHandler[i]) >= 0) continue;
    ScriptApp.deleteTrigger(existingByHandler[i]);
    deletedOld++;
  }

  const triggerIds = [];
  for (let i = 0; i < requested; i++) {
    const t = ScriptApp.newTrigger("belle_ocr_workerTick_fallback_v0").timeBased().everyMinutes(1).create();
    triggerIds.push(t.getUniqueId());
  }
  props.setProperty("BELLE_OCR_PARALLEL_TRIGGER_IDS", JSON.stringify(triggerIds));
  props.setProperty("BELLE_OCR_PARALLEL_ENABLED", "true");
  const res = { phase: "OCR_PARALLEL_ENABLE", ok: true, tag: tag, requested: requested, deletedOld: deletedOld, createdNew: triggerIds.length, triggerIds: triggerIds };
  Logger.log(res);
  return res;
}

function belle_ocr_parallel_disable_fallback_v0(opts) {
  const audit = belle_triggerAudit_run_({ remove: true });
  if (opts === true || (opts && opts.auditOnly)) {
    const res = { phase: "OCR_PARALLEL_DISABLE", ok: true, auditOnly: true, audit: audit };
    Logger.log(res);
    return res;
  }
  const props = belle_cfg_getProps_();
  const enabledBefore = belle_parseBool(props.getProperty("BELLE_OCR_PARALLEL_ENABLED"), false);
  const ids = belle_ocr_parallel_parseTriggerIds_(props);

  const handlerName = "belle_ocr_workerTick_fallback_v0";
  const triggers = belle_ocr_parallel_getTriggersByIds_(ids);
  const existingByHandler = ids.length === 0 ? belle_ocr_parallel_getTriggersByHandler_(handlerName) : [];
  let deleted = 0;
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
    deleted++;
  }
  const missing = ids.length - triggers.length;
  if (ids.length === 0) {
    for (let i = 0; i < existingByHandler.length; i++) {
      ScriptApp.deleteTrigger(existingByHandler[i]);
      deleted++;
    }
  }
  const existed = triggers.length + existingByHandler.length;
  const res = {
    phase: "OCR_PARALLEL_DISABLE",
    ok: true,
    deleted: deleted,
    missing: missing,
    existed: existed,
    enabledBefore: enabledBefore,
    note: "enabled_unchanged"
  };
  Logger.log(res);
  return res;
}
