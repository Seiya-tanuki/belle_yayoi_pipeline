function belle_log_buildLegacyName_(baseName) {
  const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
  return String(baseName || "LOG") + "__legacy__" + ts;
}

function belle_log_ensureSheetWithHeader_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    return { sheet: sh, rotated: false, created: true };
  }
  const current = sh.getRange(1, 1, 1, header.length).getValues()[0];
  const mismatch = header.some(function (h, i) {
    return String(current[i] || "") !== h;
  });
  if (mismatch) {
    const legacyName = belle_log_buildLegacyName_(name);
    sh.setName(legacyName);
    const fresh = ss.insertSheet(name);
    fresh.getRange(1, 1, 1, header.length).setValues([header]);
    return { sheet: fresh, rotated: true, legacyName: legacyName };
  }
  return { sheet: sh, rotated: false, created: false };
}

function belle_getSkipLogSheetName(props) {
  const p = props || belle_cfg_getProps_();
  return belle_cfg_getSkipLogSheetName_(p);
}

function belle_getQueueSkipLogSheetName(props) {
  const p = props || belle_cfg_getProps_();
  return belle_cfg_getQueueSkipLogSheetName_(p);
}

/**
 * Append skip details to a sheet (append-only).
 */
function belle_getSkipLogHeader_() {
  return ["logged_at_iso","phase","file_id","file_name","drive_url","doc_type","source_subfolder","reason","detail"];
}

function belle_getQueueSkipLogHeader_() {
  return ["logged_at_iso","phase","file_id","file_name","drive_url","doc_type","source_subfolder","reason","detail","first_seen_at_iso","last_seen_at_iso","seen_count"];
}

function belle_ensureSkipLogSheet_(ss, sheetName, header) {
  const ensured = belle_log_ensureSheetWithHeader_(ss, sheetName, header);
  return ensured.sheet;
}

function belle_export_skip_makeKey_(fileId, reason, detail) {
  return String(fileId || "") + "||" + String(reason || "") + "||" + String(detail || "");
}

function belle_appendSkipLogRows(ss, sheetName, details, loggedAtIso, phase) {
  if (!details || details.length === 0) return 0;
  const header = belle_getSkipLogHeader_();
  const sh = belle_ensureSkipLogSheet_(ss, sheetName, header);
  const phaseName = phase || "SKIP_LOG";
  const ts = loggedAtIso || new Date().toISOString();
  const rows = [];
  const dedupe = phaseName === "EXPORT_SKIP";
  const existing = dedupe ? new Set() : null;
  if (dedupe) {
    const lastRow = sh.getLastRow();
    if (lastRow >= 2) {
      const idValues = sh.getRange(2, 3, lastRow - 1, 1).getValues();
      const reasonValues = sh.getRange(2, 8, lastRow - 1, 1).getValues();
      const detailValues = sh.getRange(2, 9, lastRow - 1, 1).getValues();
      for (let i = 0; i < idValues.length; i++) {
        const key = belle_export_skip_makeKey_(idValues[i][0], reasonValues[i][0], detailValues[i][0]);
        existing.add(key);
      }
    }
  }
  for (let i = 0; i < details.length; i++) {
    const d = details[i] || {};
    if (dedupe) {
      const key = belle_export_skip_makeKey_(d.file_id, d.reason, d.detail);
      if (existing.has(key)) continue;
      existing.add(key);
    }
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
  const header = belle_getQueueSkipLogHeader_();
  const sh = belle_ensureSkipLogSheet_(ss, sheetName, header);
  const existing = new Set();
  const rowIndexByKey = {};
  const seenCountByKey = {};
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const idValues = sh.getRange(2, 3, lastRow - 1, 1).getValues();
    const reasonValues = sh.getRange(2, 8, lastRow - 1, 1).getValues();
    const seenValues = sh.getRange(2, 12, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      const key = belle_queue_skip_makeKey_(idValues[i][0], reasonValues[i][0]);
      existing.add(key);
      rowIndexByKey[key] = i + 2;
      seenCountByKey[key] = Number(seenValues[i] && seenValues[i][0]) || 0;
    }
  }
  const rows = [];
  const phaseName = "QUEUE_SKIP";
  const ts = loggedAtIso || new Date().toISOString();
  const updated = new Set();
  for (let i = 0; i < details.length; i++) {
    const d = details[i] || {};
    const key = belle_queue_skip_makeKey_(d.file_id, d.reason);
    if (existing.has(key)) {
      if (updated.has(key)) continue;
      updated.add(key);
      const rowIndex = rowIndexByKey[key];
      if (rowIndex) {
        const currentSeen = seenCountByKey[key] || 0;
        sh.getRange(rowIndex, 11).setValue(ts);
        sh.getRange(rowIndex, 12).setValue(currentSeen + 1);
      }
      continue;
    }
    existing.add(key);
    rowIndexByKey[key] = lastRow + 1 + rows.length;
    seenCountByKey[key] = 1;
    rows.push([
      ts,
      phaseName,
      d.file_id || "",
      d.file_name || "",
      d.drive_url || "",
      d.doc_type || "",
      d.source_subfolder || "",
      d.reason || "",
      d.detail || "",
      ts,
      ts,
      1
    ]);
  }
  return belle_sheet_appendRowsInChunks_(sh, rows, 200);
}

function belle_getExportGuardLogSheetName(props) {
  const p = props || belle_cfg_getProps_();
  return belle_cfg_getExportGuardLogSheetName_(p);
}

function belle_getExportGuardLogHeader_() {
  return ["logged_at_iso","phase","doc_type","queue_sheet_name","reason","counts_json","detail"];
}

function belle_export_buildGuardLogRow_(nowIso, data) {
  const d = data || {};
  return [
    nowIso || new Date().toISOString(),
    "EXPORT_GUARD",
    d.doc_type || "",
    d.queue_sheet_name || "",
    d.reason || "",
    d.counts_json || "",
    d.detail || ""
  ];
}

function belle_export_appendGuardLogRow_(ss, props, data) {
  const sheetName = belle_getExportGuardLogSheetName(props);
  const header = belle_getExportGuardLogHeader_();
  const ensured = belle_log_ensureSheetWithHeader_(ss, sheetName, header);
  const row = belle_export_buildGuardLogRow_(new Date().toISOString(), data);
  return belle_sheet_appendRowsInChunks_(ensured.sheet, [row], 200);
}
