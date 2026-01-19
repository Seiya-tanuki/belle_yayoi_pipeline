// @ts-check

// NOTE: Keep comments ASCII only.

function belle_ocr_parallel_getTag_(props) {
  return props.getProperty("BELLE_OCR_PARALLEL_TRIGGER_TAG") || "BELLE_OCR_PARALLEL_V0";
}

function belle_ocr_parallel_getWorkerCount_(props) {
  const raw = props.getProperty("BELLE_OCR_PARALLEL_WORKERS") || "1";
  const n = Number(raw);
  if (isNaN(n)) return null;
  return Math.floor(n);
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

function belle_ocr_workerTick_fallback_v0() {
  const props = PropertiesService.getScriptProperties();
  const enabled = belle_parseBool(props.getProperty("BELLE_OCR_PARALLEL_ENABLED"), false);
  if (!enabled) {
    const guard = { phase: "OCR_PARALLEL_GUARD", ok: true, reason: "PARALLEL_DISABLED" };
    Logger.log(guard);
    return guard;
  }

  const workerId = Utilities.getUuid();
  const result = belle_ocr_workerLoop_fallback_v0_({ workerId: workerId, maxItems: 1 });
  const res = {
    phase: "OCR_PARALLEL_TICK",
    workerId: workerId,
    ok: result && result.ok !== false,
    processed: result && result.processed ? result.processed : 0,
    done: result && result.done ? result.done : 0,
    errors: result && result.errors ? result.errors : 0
  };
  Logger.log(res);
  return res;
}

function belle_ocr_parallel_enable_fallback_v0() {
  const props = PropertiesService.getScriptProperties();
  const requested = belle_ocr_parallel_getWorkerCount_(props);
  if (!requested || requested < 1 || requested > 5) {
    const guard = { phase: "OCR_PARALLEL_ENABLE", ok: true, reason: "INVALID_WORKER_COUNT", requested: requested };
    Logger.log(guard);
    return guard;
  }

  const tag = belle_ocr_parallel_getTag_(props);
  const idsRaw = props.getProperty("BELLE_OCR_PARALLEL_TRIGGER_IDS") || "[]";
  let ids = [];
  try {
    ids = JSON.parse(idsRaw);
    if (!Array.isArray(ids)) ids = [];
  } catch (e) {
    ids = [];
  }

  const existing = belle_ocr_parallel_getTriggersByIds_(ids);
  if (existing.length > 0) {
    const res = { phase: "OCR_PARALLEL_ENABLE", ok: true, reason: "ALREADY_ENABLED", requested: requested, existing: existing.length };
    Logger.log(res);
    return res;
  }

  const triggerIds = [];
  for (let i = 0; i < requested; i++) {
    const t = ScriptApp.newTrigger("belle_ocr_workerTick_fallback_v0").timeBased().everyMinutes(1).create();
    triggerIds.push(t.getUniqueId());
  }
  props.setProperty("BELLE_OCR_PARALLEL_TRIGGER_IDS", JSON.stringify(triggerIds));
  props.setProperty("BELLE_OCR_PARALLEL_ENABLED", "true");
  const res = { phase: "OCR_PARALLEL_ENABLE", ok: true, tag: tag, requested: requested, created: triggerIds.length, triggerIds: triggerIds };
  Logger.log(res);
  return res;
}

function belle_ocr_parallel_disable_fallback_v0() {
  const props = PropertiesService.getScriptProperties();
  const idsRaw = props.getProperty("BELLE_OCR_PARALLEL_TRIGGER_IDS") || "[]";
  let ids = [];
  try {
    ids = JSON.parse(idsRaw);
    if (!Array.isArray(ids)) ids = [];
  } catch (e) {
    ids = [];
  }

  const triggers = belle_ocr_parallel_getTriggersByIds_(ids);
  let deleted = 0;
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
    deleted++;
  }
  props.deleteProperty("BELLE_OCR_PARALLEL_TRIGGER_IDS");
  props.setProperty("BELLE_OCR_PARALLEL_ENABLED", "false");
  const res = { phase: "OCR_PARALLEL_DISABLE", ok: true, deleted: deleted };
  Logger.log(res);
  return res;
}

function belle_ocr_parallel_enable_fallback_v0_test() {
  const res = belle_ocr_parallel_enable_fallback_v0();
  Logger.log(res);
  return res;
}

function belle_ocr_parallel_disable_fallback_v0_test() {
  const res = belle_ocr_parallel_disable_fallback_v0();
  Logger.log(res);
  return res;
}
