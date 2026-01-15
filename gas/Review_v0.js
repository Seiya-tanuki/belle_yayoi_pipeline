// @ts-check

// NOTE: Keep comments ASCII only.

function belle_review_getHeader() {
  const header = [
    "review_status",
    "review_reason",
    "export_status",
    "exported_at_iso",
    "export_csv_file_id",
    "source_file_id",
    "source_file_name",
    "drive_url",
    "transaction_date",
    "merchant",
    "tax_rate_bucket",
    "amount_gross_jpy",
    "debit_tax_kubun_auto",
    "debit_tax_kubun_override",
    "memo_auto",
    "memo_override"
  ];
  for (let i = 1; i <= 25; i++) {
    const n = String(i).padStart(2, "0");
    header.push("yayoi_col_" + n);
  }
  return header;
}

function belle_review_getLogHeader() {
  return ["key", "source_file_id", "tax_rate_bucket", "created_at_iso"];
}

function belle_review_getOrCreateSheet(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(header);
  } else {
    const row = sh.getRange(1, 1, 1, header.length).getValues()[0];
    for (let i = 0; i < header.length; i++) {
      if (String(row[i] || "") !== header[i]) {
        throw new Error("INVALID_REVIEW_HEADER: mismatch at col " + (i + 1));
      }
    }
  }
  return sh;
}

function belle_review_getOrCreateLogSheet(ss, name) {
  return belle_review_getOrCreateSheet(ss, name, belle_review_getLogHeader());
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

function belle_review_buildRowAuto(params) {
  const row = belle_yayoi_buildRow({
    date: params.date,
    debitTaxKubun: params.debitTaxKubun,
    gross: params.gross,
    summary: params.summary,
    memo: params.memo
  });
  return row;
}

function belle_buildReviewFromDoneQueue() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const defaultSheetName = props.getProperty("BELLE_SHEET_NAME");
  const queueSheetName = props.getProperty("BELLE_QUEUE_SHEET_NAME") || defaultSheetName;
  const reviewSheetName = props.getProperty("BELLE_REVIEW_SHEET_NAME") || "REVIEW_YAYOI";
  const reviewLogSheetName = props.getProperty("BELLE_REVIEW_LOG_SHEET_NAME") || "REVIEW_LOG";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!queueSheetName) throw new Error("Missing Script Property: BELLE_SHEET_NAME (or BELLE_QUEUE_SHEET_NAME)");

  const ss = SpreadsheetApp.openById(sheetId);
  const queue = ss.getSheetByName(queueSheetName);
  if (!queue) throw new Error("Sheet not found: " + queueSheetName);

  const review = belle_review_getOrCreateSheet(ss, reviewSheetName, belle_review_getHeader());
  const reviewLog = belle_review_getOrCreateLogSheet(ss, reviewLogSheetName);
  const logSet = belle_review_loadLogSet(reviewLog);

  const header = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
  const lastRow = queue.getLastRow();
  if (lastRow < 2) {
    return { ok: true, reviewAdded: 0, reason: "QUEUE_EMPTY" };
  }
  const headerRow = queue.getRange(1, 1, 1, header.length).getValues()[0];
  for (let i = 0; i < header.length; i++) {
    if (String(headerRow[i] || "") !== header[i]) {
      return { ok: false, reviewAdded: 0, reason: "INVALID_QUEUE_HEADER: mismatch at col " + (i + 1) };
    }
  }

  const rows = queue.getRange(2, 1, lastRow - 1, 8).getValues();
  const reviewRows = [];
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
    const docType = parsed.document_type ? String(parsed.document_type) : "unknown";
    const summary = merchant + " / " + docType;
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

      let reviewStatus = "";
      const reasons = [];
      let grossVal = null;
      let debitKubun = "";

      if (bucket === "unknown") {
        reviewStatus = "NEEDS_REVIEW";
        const reason = singleRateInfo && singleRateInfo.reason
          ? "UNKNOWN_TAX_RATE: " + singleRateInfo.reason
          : "UNKNOWN_TAX_RATE";
        reasons.push(reason);
      } else {
        const grossInfo = belle_yayoi_getGrossForRate(parsed, bucket, hasMultiple !== true, taxInOut);
        grossVal = grossInfo.gross;
        if (grossVal === null) {
          reviewStatus = "NEEDS_REVIEW";
          reasons.push("MISSING_GROSS: " + grossInfo.reason);
        }
        debitKubun = belle_yayoi_getDebitTaxKubun(bucket, parsed.transaction_date);
        if (!debitKubun) {
          reviewStatus = "NEEDS_REVIEW";
          reasons.push("MISSING_DEBIT_TAX_KUBUN");
        }
      }

      const grossStr = grossVal === null ? "" : String(grossVal);
      const row25 = belle_review_buildRowAuto({
        date: date,
        debitTaxKubun: debitKubun,
        gross: grossStr,
        summary: summary,
        memo: memoAuto
      });

      const reviewRow = [
        reviewStatus,
        reasons.join(";"),
        "",
        "",
        "",
        fileId,
        fileName,
        driveUrl,
        date,
        merchant,
        String(bucket),
        grossVal === null ? "" : grossVal,
        debitKubun,
        "",
        memoAuto,
        ""
      ].concat(row25);

      reviewRows.push(reviewRow);
      logRows.push([key, fileId, String(bucket), nowIso]);
      logSet.add(key);
    }
  }

  if (reviewRows.length > 0) {
    review.getRange(review.getLastRow() + 1, 1, reviewRows.length, reviewRows[0].length).setValues(reviewRows);
    reviewLog.getRange(reviewLog.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
  }

  const result = { ok: true, reviewAdded: reviewRows.length };
  Logger.log(result);
  return result;
}

function belle_review_getHeaderMap(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    map[String(headerRow[i] || "")] = i;
  }
  return map;
}

function belle_review_countNeedsReview() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const reviewSheetName = props.getProperty("BELLE_REVIEW_SHEET_NAME") || "REVIEW_YAYOI";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(reviewSheetName);
  if (!sh) return 0;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
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
  const reviewSheetName = props.getProperty("BELLE_REVIEW_SHEET_NAME") || "REVIEW_YAYOI";
  const outputFolderId = props.getProperty("BELLE_OUTPUT_FOLDER_ID") || props.getProperty("BELLE_DRIVE_FOLDER_ID");
  const strictExport = belle_parseBool(props.getProperty("BELLE_STRICT_EXPORT"), false);
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!outputFolderId) throw new Error("Missing Script Property: BELLE_OUTPUT_FOLDER_ID (or BELLE_DRIVE_FOLDER_ID)");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(reviewSheetName);
  if (!sh) return { ok: false, exportedRows: 0, reason: "REVIEW_SHEET_NOT_FOUND" };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    const res = { ok: true, exportedRows: 0, heldForReview: 0, strictBlocked: false, csvFileId: "" };
    Logger.log(res);
    return res;
  }

  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = belle_review_getHeaderMap(headerRow);

  const idx = {
    review_status: map["review_status"],
    export_status: map["export_status"],
    exported_at_iso: map["exported_at_iso"],
    export_csv_file_id: map["export_csv_file_id"],
    source_file_id: map["source_file_id"],
    source_file_name: map["source_file_name"],
    drive_url: map["drive_url"],
    transaction_date: map["transaction_date"],
    merchant: map["merchant"],
    tax_rate_bucket: map["tax_rate_bucket"],
    amount_gross_jpy: map["amount_gross_jpy"],
    debit_tax_kubun_auto: map["debit_tax_kubun_auto"],
    debit_tax_kubun_override: map["debit_tax_kubun_override"],
    memo_auto: map["memo_auto"],
    memo_override: map["memo_override"]
  };

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  let needsReview = 0;
  const csvRows = [];
  const exportRowIndexes = [];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const reviewStatus = String(row[idx.review_status] || "");
    const exportStatus = String(row[idx.export_status] || "");
    if (exportStatus === "EXPORTED") continue;

    if (reviewStatus === "NEEDS_REVIEW") {
      needsReview++;
      continue;
    }

    const gross = String(row[idx.amount_gross_jpy] || "");
    const debitAuto = String(row[idx.debit_tax_kubun_auto] || "");
    const debitOverride = String(row[idx.debit_tax_kubun_override] || "");
    const memoAuto = String(row[idx.memo_auto] || "");
    const memoOverride = String(row[idx.memo_override] || "");
    if (!gross || !(debitOverride || debitAuto)) {
      needsReview++;
      continue;
    }

    const date = belle_yayoi_formatDate(row[idx.transaction_date]);
    const merchant = String(row[idx.merchant] || "unknown");
    const bucket = String(row[idx.tax_rate_bucket] || "unknown");
    const summary = merchant + " / " + bucket;

    const debit = debitOverride || debitAuto;
    const memo = memoOverride || memoAuto;
    const row25 = belle_review_buildRowAuto({
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
    const res = {
      ok: false,
      exportedRows: 0,
      exportedFiles: 0,
      heldForReview: needsReview,
      strictBlocked: true,
      csvFileId: ""
    };
    Logger.log(res);
    return res;
  }

  if (csvRows.length === 0) {
    const res = {
      ok: true,
      exportedRows: 0,
      exportedFiles: 0,
      heldForReview: needsReview,
      strictBlocked: false,
      csvFileId: ""
    };
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

  const exportStatusCol = idx.export_status + 1;
  const exportedAtCol = idx.exported_at_iso + 1;
  const csvFileCol = idx.export_csv_file_id + 1;
  for (let i = 0; i < exportRowIndexes.length; i++) {
    const rowNum = exportRowIndexes[i];
    sh.getRange(rowNum, exportStatusCol, 1, 3).setValues([["EXPORTED", nowIso, csvFileId]]);
  }

  const result = {
    ok: true,
    exportedRows: csvRows.length,
    exportedFiles: 1,
    heldForReview: needsReview,
    strictBlocked: false,
    csvFileId: csvFileId
  };
  Logger.log(result);
  return result;
}
