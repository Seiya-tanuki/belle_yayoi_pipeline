// @ts-check

// NOTE: Keep comments ASCII only.

function belle_review_state_header() {
  return [
    "review_key",
    "source_file_id",
    "source_file_name",
    "drive_url",
    "transaction_date",
    "merchant",
    "receipt_total_jpy",
    "tax_rate_bucket_auto",
    "tax_rate_bucket_override",
    "debit_tax_kubun_auto",
    "debit_tax_kubun_override",
    "memo_auto",
    "memo_override",
    "review_status",
    "review_reason_code",
    "review_reason",
    "export_status",
    "exported_at_iso",
    "export_csv_file_id",
    "amount_gross_jpy"
  ];
}

function belle_review_ui_header() {
  return [
    "review_status",
    "review_reason",
    "source_file_name",
    "drive_url",
    "transaction_date",
    "merchant",
    "receipt_total_jpy",
    "tax_rate_bucket_override",
    "debit_tax_kubun_override",
    "memo_override",
    "review_key"
  ];
}

function belle_review_log_header() {
  return ["review_key", "source_file_id", "tax_rate_bucket", "created_at_iso"];
}

function belle_review_getHeaderRow(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function belle_review_getHeaderMap(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    map[String(headerRow[i] || "")] = i;
  }
  return map;
}

function belle_review_getOrCreateSheet(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(header);
    return sh;
  }
  const row = belle_review_getHeaderRow(sh);
  let nextCol = row.length + 1;
  for (let i = 0; i < header.length; i++) {
    if (row.indexOf(header[i]) === -1) {
      sh.getRange(1, nextCol).setValue(header[i]);
      nextCol++;
    }
  }
  return sh;
}

function belle_review_ui_headerMatches(headerRow) {
  const target = belle_review_ui_header();
  if (headerRow.length !== target.length) return false;
  for (let i = 0; i < target.length; i++) {
    if (String(headerRow[i] || "") !== target[i]) return false;
  }
  return true;
}

function belle_review_makeKey(fileId, bucket) {
  return String(fileId) + "|" + String(bucket);
}

function belle_review_loadLogSet(logSheet) {
  const set = new Set();
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return set;
  const vals = logSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i][0];
    if (v) set.add(String(v));
  }
  return set;
}

function belle_review_hasRate(parsed, rate) {
  if (!parsed) return false;
  const tb = parsed.tax_breakdown;
  const bucket = tb && (rate === 10 ? tb.rate_10 : tb.rate_8);
  if (bucket) {
    const g = belle_yayoi_isNumber(bucket.gross_amount_jpy);
    const t = belle_yayoi_isNumber(bucket.taxable_amount_jpy);
    const tax = belle_yayoi_isNumber(bucket.tax_jpy);
    if (g !== null || t !== null || tax !== null) return true;
  }
  if (Array.isArray(parsed.line_items)) {
    for (let i = 0; i < parsed.line_items.length; i++) {
      const item = parsed.line_items[i];
      if (item && item.tax_rate === rate) return true;
    }
  }
  return false;
}

function belle_review_effectiveBucket(autoBucket, overrideBucket) {
  if (overrideBucket === "8" || overrideBucket === "10") return overrideBucket;
  if (autoBucket === "8" || autoBucket === "10") return autoBucket;
  return "unknown";
}

function belle_review_effectiveDebit(autoKubun, overrideKubun) {
  return overrideKubun || autoKubun || "";
}

function belle_review_computeStatus(bucket, debitKubun, gross) {
  const codes = [];
  if (bucket !== "8" && bucket !== "10") {
    codes.push("UNKNOWN_TAX_RATE");
  }
  if (!gross && gross !== 0) {
    codes.push("GROSS_UNKNOWN");
  }
  if (!debitKubun) {
    codes.push("MISSING_DEBIT_TAX_KUBUN");
  }
  if (codes.length === 0) {
    return { status: "", codes: [], reason: "" };
  }
  const reasons = [];
  for (let i = 0; i < codes.length; i++) {
    reasons.push(belle_reviewReasonJa(codes[i], {}));
  }
  return { status: "NEEDS_REVIEW", codes: codes, reason: reasons.join(" / ") };
}

function belle_review_applyUiOverridesToState(stateSheet, stateMap, uiSheet) {
  const uiRows = uiSheet.getLastRow();
  if (uiRows < 2 || uiSheet.getLastColumn() === 0) return { updated: 0 };
  const uiHeader = belle_review_getHeaderRow(uiSheet);
  const uiMap = belle_review_getHeaderMap(uiHeader);
  const uiVals = uiSheet.getRange(2, 1, uiRows - 1, uiSheet.getLastColumn()).getValues();
  const uiByKey = {};
  for (let i = 0; i < uiVals.length; i++) {
    if (uiMap["review_key"] === undefined) continue;
    const key = String(uiVals[i][uiMap["review_key"]] || "");
    if (!key) continue;
    uiByKey[key] = uiVals[i];
  }

  const stateRows = stateSheet.getLastRow();
  if (stateRows < 2) return { updated: 0 };
  const stateVals = stateSheet.getRange(2, 1, stateRows - 1, stateSheet.getLastColumn()).getValues();
  let updated = 0;

  for (let i = 0; i < stateVals.length; i++) {
    const row = stateVals[i];
    const key = String(row[stateMap["review_key"]] || "");
    if (!key || !uiByKey[key]) continue;

    const uiRow = uiByKey[key];
    const uiTaxOverride = uiMap["tax_rate_bucket_override"] !== undefined
      ? String(uiRow[uiMap["tax_rate_bucket_override"]] || "")
      : "";
    const uiDebitOverride = uiMap["debit_tax_kubun_override"] !== undefined
      ? String(uiRow[uiMap["debit_tax_kubun_override"]] || "")
      : "";
    const uiMemoOverride = uiMap["memo_override"] !== undefined
      ? String(uiRow[uiMap["memo_override"]] || "")
      : "";

    if (uiTaxOverride) row[stateMap["tax_rate_bucket_override"]] = uiTaxOverride;
    if (uiDebitOverride) row[stateMap["debit_tax_kubun_override"]] = uiDebitOverride;
    if (uiMemoOverride) row[stateMap["memo_override"]] = uiMemoOverride;

    const autoBucket = String(row[stateMap["tax_rate_bucket_auto"]] || "");
    const effBucket = belle_review_effectiveBucket(autoBucket, String(row[stateMap["tax_rate_bucket_override"]] || ""));
    const autoKubun = String(row[stateMap["debit_tax_kubun_auto"]] || "");
    const effKubun = belle_review_effectiveDebit(autoKubun, String(row[stateMap["debit_tax_kubun_override"]] || ""));
    const exportStatus = String(row[stateMap["export_status"]] || "");
    let gross = row[stateMap["amount_gross_jpy"]];

    if (exportStatus !== "EXPORTED") {
      const grossEmpty = gross === "" || gross === null || gross === undefined;
      if (grossEmpty && (effBucket === "8" || effBucket === "10")) {
        const receiptTotal = row[stateMap["receipt_total_jpy"]];
        if (receiptTotal !== "" && receiptTotal !== null && receiptTotal !== undefined) {
          row[stateMap["amount_gross_jpy"]] = receiptTotal;
          gross = receiptTotal;
        }
      }
    }

    const statusInfo = belle_review_computeStatus(effBucket, effKubun, gross);
    row[stateMap["review_status"]] = statusInfo.status;
    row[stateMap["review_reason_code"]] = statusInfo.codes.join(";");
    row[stateMap["review_reason"]] = statusInfo.reason;

    updated++;
  }

  if (updated > 0) {
    stateSheet.getRange(2, 1, stateVals.length, stateSheet.getLastColumn()).setValues(stateVals);
  }
  return { updated: updated };
}

function belle_review_syncUiFromState(stateSheet, stateMap, uiSheet) {
  if (uiSheet.getLastColumn() === 0) {
    uiSheet.appendRow(belle_review_ui_header());
  }
  const uiHeader = belle_review_getHeaderRow(uiSheet);
  const uiMap = belle_review_getHeaderMap(uiHeader);

  const uiRows = uiSheet.getLastRow();
  const uiVals = uiRows >= 2
    ? uiSheet.getRange(2, 1, uiRows - 1, uiSheet.getLastColumn()).getValues()
    : [];

  const uiIndexByKey = {};
  for (let i = 0; i < uiVals.length; i++) {
    const key = String(uiVals[i][uiMap["review_key"]] || "");
    if (key) uiIndexByKey[key] = i;
  }

  const stateRows = stateSheet.getLastRow();
  if (stateRows < 2) return { updated: 0, appended: 0 };
  const stateVals = stateSheet.getRange(2, 1, stateRows - 1, stateSheet.getLastColumn()).getValues();

  let updated = 0;
  const appendRows = [];
  for (let i = 0; i < stateVals.length; i++) {
    const s = stateVals[i];
    const key = String(s[stateMap["review_key"]] || "");
    if (!key) continue;

    const row = new Array(uiHeader.length);
    if (uiMap["review_status"] !== undefined) row[uiMap["review_status"]] = s[stateMap["review_status"]];
    if (uiMap["review_reason"] !== undefined) row[uiMap["review_reason"]] = s[stateMap["review_reason"]];
    if (uiMap["source_file_name"] !== undefined) row[uiMap["source_file_name"]] = s[stateMap["source_file_name"]];
    if (uiMap["drive_url"] !== undefined) row[uiMap["drive_url"]] = s[stateMap["drive_url"]];
    if (uiMap["transaction_date"] !== undefined) row[uiMap["transaction_date"]] = s[stateMap["transaction_date"]];
    if (uiMap["merchant"] !== undefined) row[uiMap["merchant"]] = s[stateMap["merchant"]];
    if (uiMap["receipt_total_jpy"] !== undefined) row[uiMap["receipt_total_jpy"]] = s[stateMap["receipt_total_jpy"]];
    if (uiMap["tax_rate_bucket_override"] !== undefined) row[uiMap["tax_rate_bucket_override"]] = s[stateMap["tax_rate_bucket_override"]];
    if (uiMap["debit_tax_kubun_override"] !== undefined) row[uiMap["debit_tax_kubun_override"]] = s[stateMap["debit_tax_kubun_override"]];
    if (uiMap["memo_override"] !== undefined) row[uiMap["memo_override"]] = s[stateMap["memo_override"]];
    if (uiMap["review_key"] !== undefined) row[uiMap["review_key"]] = key;

    if (uiIndexByKey[key] !== undefined) {
      const idx = uiIndexByKey[key];
      uiVals[idx] = row;
      updated++;
    } else {
      appendRows.push(row);
    }
  }

  if (updated > 0 && uiVals.length > 0) {
    uiSheet.getRange(2, 1, uiVals.length, uiSheet.getLastColumn()).setValues(uiVals);
  }
  if (appendRows.length > 0) {
    uiSheet.getRange(uiSheet.getLastRow() + 1, 1, appendRows.length, uiSheet.getLastColumn()).setValues(appendRows);
  }
  return { updated: updated, appended: appendRows.length };
}

function belle_buildReviewFromDoneQueue() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const defaultSheetName = props.getProperty("BELLE_SHEET_NAME");
  const queueSheetName = props.getProperty("BELLE_QUEUE_SHEET_NAME") || defaultSheetName;
  const stateSheetName = props.getProperty("BELLE_REVIEW_STATE_SHEET_NAME") || "REVIEW_STATE";
  const uiSheetName = props.getProperty("BELLE_REVIEW_UI_SHEET_NAME") || "REVIEW_UI";
  const reviewLogSheetName = props.getProperty("BELLE_REVIEW_LOG_SHEET_NAME") || "REVIEW_LOG";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!queueSheetName) throw new Error("Missing Script Property: BELLE_SHEET_NAME (or BELLE_QUEUE_SHEET_NAME)");

  const ss = SpreadsheetApp.openById(sheetId);
  const queue = ss.getSheetByName(queueSheetName);
  if (!queue) throw new Error("Sheet not found: " + queueSheetName);

  const state = belle_review_getOrCreateSheet(ss, stateSheetName, belle_review_state_header());
  let ui = ss.getSheetByName(uiSheetName);
  if (!ui) ui = ss.insertSheet(uiSheetName);
  const log = belle_review_getOrCreateSheet(ss, reviewLogSheetName, belle_review_log_header());
  const logSet = belle_review_loadLogSet(log);

  const stateHeader = belle_review_getHeaderRow(state);
  const stateMap = belle_review_getHeaderMap(stateHeader);
  let uiHeaderRow = [];
  if (ui.getLastColumn() > 0) {
    uiHeaderRow = belle_review_getHeaderRow(ui);
  }

  const header = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
  const lastRow = queue.getLastRow();
  if (lastRow < 2) {
    const result = { ok: true, reviewAdded: 0, reason: "QUEUE_EMPTY" };
    Logger.log(result);
    return result;
  }
  const headerRow = queue.getRange(1, 1, 1, header.length).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(headerRow[i] || "") !== header[i]) {
      return { ok: false, reviewAdded: 0, reason: "INVALID_QUEUE_HEADER: mismatch at col " + (i + 1) };
    }
  }

  const rows = queue.getRange(2, 1, lastRow - 1, 8).getValues();
  const stateRows = [];
  const logRows = [];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = String(row[0] || "");
    const fileId = String(row[1] || "");
    const fileName = String(row[2] || "");
    const driveUrl = String(row[4] || "");
    const ocrJson = String(row[6] || "");
    if (status !== "DONE") continue;
    if (!fileId || !ocrJson) continue;

    let parsed;
    try {
      parsed = JSON.parse(ocrJson);
    } catch (e) {
      continue;
    }

    const date = belle_yayoi_formatDate(parsed.transaction_date);
    const merchant = parsed.merchant ? String(parsed.merchant) : "unknown";
    const receiptTotal = belle_yayoi_isNumber(parsed.receipt_total_jpy);
    const memoAuto = (driveUrl + " " + fileId).trim().slice(0, 200);

    const taxInOut = parsed.tax_meta ? parsed.tax_meta.tax_in_out : null;
    const hasMultiple = parsed.tax_breakdown && typeof parsed.tax_breakdown.has_multiple_rates === "boolean"
      ? parsed.tax_breakdown.has_multiple_rates
      : null;

    const buckets = [];
    let singleRateInfo = null;
    if (hasMultiple === true) {
      if (belle_review_hasRate(parsed, 10)) buckets.push(10);
      if (belle_review_hasRate(parsed, 8)) buckets.push(8);
      if (buckets.length === 0) buckets.push("unknown");
    } else {
      singleRateInfo = belle_yayoi_determineSingleRate(parsed);
      if (singleRateInfo.rate === 8 || singleRateInfo.rate === 10) {
        buckets.push(singleRateInfo.rate);
      } else {
        buckets.push("unknown");
      }
    }

    for (let b = 0; b < buckets.length; b++) {
      const bucket = buckets[b];
      const key = belle_review_makeKey(fileId, bucket);
      if (logSet.has(key)) continue;

      let grossVal = null;
      let debitKubun = "";
      let reviewStatus = "";
      let reasonCode = "";
      let reasonText = "";

      if (bucket === "unknown") {
        const code = singleRateInfo && singleRateInfo.reason === "NO_RATE_IN_TAX_META_OR_LINE_ITEMS"
          ? "UNKNOWN_SINGLE_RATE"
          : "UNKNOWN_TAX_RATE";
        reviewStatus = "NEEDS_REVIEW";
        reasonCode = code + (singleRateInfo && singleRateInfo.reason ? ":" + singleRateInfo.reason : "");
        reasonText = belle_reviewReasonJa(code, { file_name: fileName, merchant: merchant, detail: singleRateInfo ? singleRateInfo.reason : "" });
      } else {
        const grossInfo = belle_yayoi_getGrossForRate(parsed, bucket, hasMultiple !== true, taxInOut);
        grossVal = grossInfo.gross;
        debitKubun = belle_yayoi_getDebitTaxKubun(bucket, parsed.transaction_date);
        const statusInfo = belle_review_computeStatus(String(bucket), debitKubun, grossVal);
        reviewStatus = statusInfo.status;
        reasonCode = statusInfo.codes.join(";");
        reasonText = statusInfo.reason;
      }

      const stateRow = new Array(stateHeader.length);
      stateRow[stateMap["review_key"]] = key;
      stateRow[stateMap["source_file_id"]] = fileId;
      stateRow[stateMap["source_file_name"]] = fileName;
      stateRow[stateMap["drive_url"]] = driveUrl;
      stateRow[stateMap["transaction_date"]] = date;
      stateRow[stateMap["merchant"]] = merchant;
      stateRow[stateMap["receipt_total_jpy"]] = receiptTotal === null ? "" : receiptTotal;
      stateRow[stateMap["tax_rate_bucket_auto"]] = String(bucket);
      stateRow[stateMap["tax_rate_bucket_override"]] = "";
      stateRow[stateMap["debit_tax_kubun_auto"]] = debitKubun;
      stateRow[stateMap["debit_tax_kubun_override"]] = "";
      stateRow[stateMap["memo_auto"]] = memoAuto;
      stateRow[stateMap["memo_override"]] = "";
      stateRow[stateMap["review_status"]] = reviewStatus;
      stateRow[stateMap["review_reason_code"]] = reasonCode;
      stateRow[stateMap["review_reason"]] = reasonText;
      stateRow[stateMap["export_status"]] = "";
      stateRow[stateMap["exported_at_iso"]] = "";
      stateRow[stateMap["export_csv_file_id"]] = "";
      stateRow[stateMap["amount_gross_jpy"]] = grossVal === null ? "" : grossVal;

      stateRows.push(stateRow);
      logRows.push([key, fileId, String(bucket), nowIso]);
      logSet.add(key);
    }
  }

  if (stateRows.length > 0) {
    state.getRange(state.getLastRow() + 1, 1, stateRows.length, stateRows[0].length).setValues(stateRows);
    log.getRange(log.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
  }

  belle_review_applyUiOverridesToState(state, stateMap, ui);

  if (!belle_review_ui_headerMatches(uiHeaderRow)) {
    const legacyName = uiSheetName + "_LEGACY_" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
    ui.setName(legacyName);
    ui = ss.insertSheet(uiSheetName);
    ui.appendRow(belle_review_ui_header());
  } else if (ui.getLastRow() === 0) {
    ui.appendRow(belle_review_ui_header());
  }

  belle_review_applyUiOverridesToState(state, stateMap, ui);
  belle_review_syncUiFromState(state, stateMap, ui);

  const result = { ok: true, reviewAdded: stateRows.length };
  Logger.log(result);
  return result;
}

function belle_review_countNeedsReview() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const stateSheetName = props.getProperty("BELLE_REVIEW_STATE_SHEET_NAME") || "REVIEW_STATE";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(stateSheetName);
  if (!sh) return 0;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  const headerRow = belle_review_getHeaderRow(sh);
  const map = belle_review_getHeaderMap(headerRow);
  const idx = map["review_status"];
  if (idx === undefined) return 0;
  const vals = sh.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  let count = 0;
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || "") === "NEEDS_REVIEW") count++;
  }
  return count;
}

function belle_exportYayoiCsvFromReview(options) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const stateSheetName = props.getProperty("BELLE_REVIEW_STATE_SHEET_NAME") || "REVIEW_STATE";
  const uiSheetName = props.getProperty("BELLE_REVIEW_UI_SHEET_NAME") || "REVIEW_UI";
  const outputFolderId = props.getProperty("BELLE_OUTPUT_FOLDER_ID") || props.getProperty("BELLE_DRIVE_FOLDER_ID");
  const strictOverride = options && typeof options.strictExport === "boolean" ? options.strictExport : null;
  const strictExport = strictOverride !== null
    ? strictOverride
    : belle_parseBool(props.getProperty("BELLE_STRICT_EXPORT"), false);
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  const importLogName = props.getProperty("BELLE_IMPORT_LOG_SHEET_NAME") || "IMPORT_LOG";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!outputFolderId) throw new Error("Missing Script Property: BELLE_OUTPUT_FOLDER_ID (or BELLE_DRIVE_FOLDER_ID)");

  const ss = SpreadsheetApp.openById(sheetId);
  const state = ss.getSheetByName(stateSheetName);
  const ui = ss.getSheetByName(uiSheetName);
  if (!state || !ui) {
    const res = { ok: false, exportedRows: 0, exportedFiles: 0, heldForReview: 0, strictBlocked: false, csvFileId: "", message: "REVIEW_SHEET_NOT_FOUND" };
    Logger.log(res);
    return res;
  }

  const stateHeader = belle_review_getHeaderRow(state);
  const stateMap = belle_review_getHeaderMap(stateHeader);
  belle_review_applyUiOverridesToState(state, stateMap, ui);
  belle_review_syncUiFromState(state, stateMap, ui);

  const stateRows = state.getLastRow();
  if (stateRows < 2) {
    const res = { ok: true, exportedRows: 0, exportedFiles: 0, heldForReview: 0, strictBlocked: false, csvFileId: "", message: "NO_ROWS" };
    Logger.log(res);
    return res;
  }

  const stateVals = state.getRange(2, 1, stateRows - 1, state.getLastColumn()).getValues();
  const csvRows = [];
  const exportRowIndexes = [];
  let needsReview = 0;
  const blocked = [];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < stateVals.length; i++) {
    const row = stateVals[i];
    const exportStatus = String(row[stateMap["export_status"]] || "");
    const reviewStatus = String(row[stateMap["review_status"]] || "");
    if (exportStatus === "EXPORTED") continue;
    if (reviewStatus === "NEEDS_REVIEW") {
      needsReview++;
      blocked.push({
        review_key: String(row[stateMap["review_key"]] || ""),
        review_reason_code: String(row[stateMap["review_reason_code"]] || ""),
        amount_gross_jpy: row[stateMap["amount_gross_jpy"]]
      });
      continue;
    }

    const autoBucket = String(row[stateMap["tax_rate_bucket_auto"]] || "");
    const overrideBucket = String(row[stateMap["tax_rate_bucket_override"]] || "");
    const bucket = belle_review_effectiveBucket(autoBucket, overrideBucket);
    const autoKubun = String(row[stateMap["debit_tax_kubun_auto"]] || "");
    const overrideKubun = String(row[stateMap["debit_tax_kubun_override"]] || "");
    const debit = belle_review_effectiveDebit(autoKubun, overrideKubun);
    const memo = String(row[stateMap["memo_override"]] || "") || String(row[stateMap["memo_auto"]] || "");
    const gross = row[stateMap["amount_gross_jpy"]];
    const date = belle_yayoi_formatDate(row[stateMap["transaction_date"]]);
    const merchant = String(row[stateMap["merchant"]] || "unknown");
    const summary = merchant + " / " + bucket;

    if ((bucket !== "8" && bucket !== "10") || !debit || (gross === "" || gross === null)) {
      needsReview++;
      continue;
    }

    const row25 = belle_yayoi_buildRow({
      date: date,
      debitTaxKubun: debit,
      gross: String(gross),
      summary: summary,
      memo: memo
    });
    csvRows.push(belle_yayoi_buildCsvRow(row25));
    exportRowIndexes.push(i + 2);
    if (csvRows.length >= batchMaxRows) break;
  }

  if (strictExport && needsReview > 0) {
    Logger.log({
      ok: false,
      reason: "STRICT_BLOCKED",
      blocked: blocked
    });
    const res = { ok: false, exportedRows: 0, exportedFiles: 0, heldForReview: needsReview, strictBlocked: true, csvFileId: "", message: "STRICT_BLOCKED" };
    Logger.log(res);
    return res;
  }

  if (csvRows.length === 0) {
    const res = { ok: true, exportedRows: 0, exportedFiles: 0, heldForReview: needsReview, strictBlocked: false, csvFileId: "", message: "NO_READY_ROWS" };
    Logger.log(res);
    return res;
  }

  const eol = eolMode === "LF" ? "\n" : "\r\n";
  const csvText = csvRows.join(eol);
  const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
  const filename = "belle_yayoi_review_export_" + ts + ".csv";
  const blob = Utilities.newBlob("", "text/csv", filename);
  if (encodingMode === "UTF8") {
    blob.setDataFromString(csvText, "UTF-8");
  } else {
    blob.setDataFromString(csvText, "Shift_JIS");
  }
  const file = DriveApp.getFolderById(outputFolderId).createFile(blob);
  const csvFileId = file.getId();

  for (let i = 0; i < exportRowIndexes.length; i++) {
    const rowNum = exportRowIndexes[i];
    state.getRange(rowNum, stateMap["export_status"] + 1, 1, 3)
      .setValues([["EXPORTED", nowIso, csvFileId]]);
  }

  let importLog = ss.getSheetByName(importLogName);
  if (!importLog) {
    importLog = ss.insertSheet(importLogName);
    importLog.appendRow(["file_id","exported_at_iso","csv_file_id"]);
  }
  for (let i = 0; i < exportRowIndexes.length; i++) {
    const rowNum = exportRowIndexes[i];
    const key = String(state.getRange(rowNum, stateMap["review_key"] + 1).getValue());
    importLog.appendRow([key, nowIso, csvFileId]);
  }

  const result = {
    ok: true,
    exportedRows: csvRows.length,
    exportedFiles: 1,
    heldForReview: needsReview,
    strictBlocked: false,
    csvFileId: csvFileId,
    message: "EXPORTED"
  };
  Logger.log(result);
  return result;
}

function belle_exportYayoiCsvFromReview_test() {
  return belle_exportYayoiCsvFromReview({});
}

function belle_backfillReviewReasonsJa() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const stateSheetName = props.getProperty("BELLE_REVIEW_STATE_SHEET_NAME") || "REVIEW_STATE";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(stateSheetName);
  if (!sh) return { ok: false, updated: 0, skipped: 0, reason: "REVIEW_SHEET_NOT_FOUND" };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, updated: 0, skipped: 0, reason: "NO_ROWS" };

  const headerRow = belle_review_getHeaderRow(sh);
  const map = belle_review_getHeaderMap(headerRow);
  const idxStatus = map["review_status"];
  const idxReason = map["review_reason"];
  const idxReasonCode = map["review_reason_code"];
  const idxMerchant = map["merchant"];
  const idxFileName = map["source_file_name"];
  const idxBucket = map["tax_rate_bucket_auto"];

  if (idxStatus === undefined || idxReason === undefined || idxReasonCode === undefined) {
    return { ok: false, updated: 0, skipped: 0, reason: "MISSING_REQUIRED_COLUMNS" };
  }

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const reasonCol = [];
  const codeCol = [];
  let updated = 0;
  let skipped = 0;
  const englishRe = /^[A-Z_]+(?::|$)/;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const status = String(row[idxStatus] || "");
    const reason = String(row[idxReason] || "");
    const reasonCode = String(row[idxReasonCode] || "");

    reasonCol.push([row[idxReason]]);
    codeCol.push([row[idxReasonCode]]);

    if (status !== "NEEDS_REVIEW") {
      skipped++;
      continue;
    }

    const reasonIsEnglish = englishRe.test(reason);
    const codeIsEnglish = englishRe.test(reasonCode);
    if (!reasonIsEnglish && !codeIsEnglish && reasonCode) {
      skipped++;
      continue;
    }
    if (!reasonIsEnglish && !codeIsEnglish && !reasonCode) {
      skipped++;
      continue;
    }

    const source = codeIsEnglish ? reasonCode : reason;
    const parts = source.split(":");
    const base = String(parts[0] || "").trim();
    const detail = parts.length > 1 ? parts.slice(1).join(":").trim() : "";
    if (!base) {
      skipped++;
      continue;
    }

    const merchant = idxMerchant !== undefined ? String(row[idxMerchant] || "") : "";
    const fileName = idxFileName !== undefined ? String(row[idxFileName] || "") : "";
    const bucket = idxBucket !== undefined ? String(row[idxBucket] || "") : "";

    const ja = belle_reviewReasonJa(base, {
      detail: detail,
      merchant: merchant,
      file_name: fileName,
      tax_rate_bucket: bucket
    });
    const codeValue = detail ? base + ":" + detail : base;

    reasonCol[i] = [ja];
    codeCol[i] = [codeValue];
    updated++;
  }

  if (updated > 0) {
    sh.getRange(2, idxReason + 1, reasonCol.length, 1).setValues(reasonCol);
    sh.getRange(2, idxReasonCode + 1, codeCol.length, 1).setValues(codeCol);
  }

  const result = { ok: true, updated: updated, skipped: skipped };
  Logger.log(result);
  return result;
}

function belle_backfillReviewReasonsJa_test() {
  return belle_backfillReviewReasonsJa();
}
