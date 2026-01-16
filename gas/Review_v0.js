// @ts-check

// NOTE: Keep comments ASCII only.

function belle_queue_ensureHeaderMapForExport(sh, baseHeader, extraHeader) {
  const required = baseHeader.concat(extraHeader || []);
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(required);
  }

  let headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let nextCol = headerRow.length + 1;
  for (let i = 0; i < required.length; i++) {
    if (headerRow.indexOf(required[i]) === -1) {
      sh.getRange(1, nextCol).setValue(required[i]);
      nextCol++;
    }
  }

  headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    map[String(headerRow[i] || "")] = i;
  }
  for (let i = 0; i < baseHeader.length; i++) {
    if (map[baseHeader[i]] === undefined) {
      return null;
    }
  }
  return map;
}

function belle_exportYayoiCsvFromReview(options) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const defaultSheetName = props.getProperty("BELLE_SHEET_NAME");
  const queueSheetName = props.getProperty("BELLE_QUEUE_SHEET_NAME") || defaultSheetName;
  const outputFolderId = props.getProperty("BELLE_OUTPUT_FOLDER_ID") || props.getProperty("BELLE_DRIVE_FOLDER_ID");
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  // Default label must be a plain value (no extra description).
  const fallbackDebitDefault = String(props.getProperty("BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT") || "対象外");
  const importLogName = props.getProperty("BELLE_IMPORT_LOG_SHEET_NAME") || "IMPORT_LOG";
  const skipLogSheetName = props.getProperty("BELLE_SKIP_LOG_SHEET_NAME") || "EXPORT_SKIP_LOG";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!queueSheetName) throw new Error("Missing Script Property: BELLE_SHEET_NAME (or BELLE_QUEUE_SHEET_NAME)");
  if (!outputFolderId) throw new Error("Missing Script Property: BELLE_OUTPUT_FOLDER_ID (or BELLE_DRIVE_FOLDER_ID)");

  const ss = SpreadsheetApp.openById(sheetId);
  try {
    const queue = ss.getSheetByName(queueSheetName);
    if (!queue) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "QUEUE_SHEET_NOT_FOUND", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }

    const baseHeader = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
    const extraHeader = ["ocr_attempts","ocr_last_attempt_at_iso","ocr_next_retry_at_iso","ocr_error_code","ocr_error_detail"];
    const lastRow = queue.getLastRow();
    if (lastRow < 2) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "NO_ROWS", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const headerMap = belle_queue_ensureHeaderMapForExport(queue, baseHeader, extraHeader);
    if (!headerMap) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "INVALID_QUEUE_HEADER: missing required columns", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }

    const rows = queue.getRange(2, 1, lastRow - 1, queue.getLastColumn()).getValues();
    const counts = {
      totalCount: 0,
      doneCount: 0,
      errorRetryableCount: 0,
      errorFinalCount: 0,
      queuedRemaining: 0
    };
    const pendingSamples = [];
    const retryableSamples = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fileId = String(row[headerMap["file_id"]] || "");
      const fileName = String(row[headerMap["file_name"]] || "");
      if (!fileId) continue;
      counts.totalCount++;
      const statusRaw = String(row[headerMap["status"]] || "");
      const status = statusRaw || "QUEUED";
      if (status === "DONE") counts.doneCount++;
      else if (status === "ERROR_FINAL") counts.errorFinalCount++;
      else if (status === "ERROR_RETRYABLE" || status === "ERROR") {
        counts.errorRetryableCount++;
        if (retryableSamples.length < 5) {
          retryableSamples.push({ file_id: fileId, file_name: fileName, status: status });
        }
      } else {
        counts.queuedRemaining++;
        if (pendingSamples.length < 5) {
          pendingSamples.push({ file_id: fileId, file_name: fileName, status: status });
        }
      }
    }

    Logger.log({
      phase: "EXPORT_START",
      ok: true,
      totalCount: counts.totalCount,
      doneCount: counts.doneCount,
      errorRetryableCount: counts.errorRetryableCount,
      errorFinalCount: counts.errorFinalCount,
      queuedRemaining: counts.queuedRemaining
    });

    if (counts.queuedRemaining > 0) {
      const res = {
        phase: "EXPORT_GUARD",
        ok: true,
        reason: "OCR_PENDING",
        exportedRows: 0,
        exportedFiles: 0,
        errors: 0,
        queuedRemaining: counts.queuedRemaining,
        doneCount: counts.doneCount,
        totalCount: counts.totalCount,
        pendingSamples: pendingSamples,
        csvFileId: ""
      };
      Logger.log(res);
      return res;
    }
    if (counts.errorRetryableCount > 0) {
      const res = {
        phase: "EXPORT_GUARD",
        ok: true,
        reason: "OCR_RETRYABLE_REMAINING",
        exportedRows: 0,
        exportedFiles: 0,
        errors: 0,
        queuedRemaining: 0,
        doneCount: counts.doneCount,
        totalCount: counts.totalCount,
        pendingSamples: retryableSamples,
        csvFileId: ""
      };
      Logger.log(res);
      return res;
    }

    let importLog = ss.getSheetByName(importLogName);
    if (!importLog) {
      importLog = ss.insertSheet(importLogName);
      importLog.appendRow(["file_id","exported_at_iso","csv_file_id"]);
    }
    const importSet = new Set();
    const logRows = importLog.getLastRow();
    if (logRows >= 2) {
      const vals = importLog.getRange(2, 1, logRows - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i][0];
        if (v) importSet.add(String(v));
      }
    }

    const csvRows = [];
    const exportFileIds = [];
    let skipped = 0;
    let errors = 0;
    const processed = new Set();
    const skippedDetails = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      if (csvRows.length >= batchMaxRows) break;
      const row = rows[i];
      const statusRaw = String(row[headerMap["status"]] || "");
      const status = statusRaw || "QUEUED";
      const fileId = String(row[headerMap["file_id"]] || "");
      const fileName = String(row[headerMap["file_name"]] || "");
      const driveUrl = String(row[headerMap["drive_url"]] || "");
      const queuedAt = String(row[headerMap["queued_at_iso"]] || "");
      const ocrJson = String(row[headerMap["ocr_json"]] || "");
      const errorCode = String(row[headerMap["ocr_error_code"]] || "");
      const errorDetail = String(row[headerMap["ocr_error_detail"]] || "");
      if (!fileId) continue;
      if (processed.has(fileId)) continue;
      processed.add(fileId);
      if (importSet.has(fileId)) {
        skipped++;
        continue;
      }

      if (status !== "DONE" && status !== "ERROR_FINAL") {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, reason: "OCR_NOT_DONE:" + status });
        continue;
      }

      let parsed = null;
      let reasonCodes = [];
      let memoErr = "";

      if (status === "DONE") {
        if (!ocrJson) {
          reasonCodes.push("OCR_JSON_MISSING");
          errors++;
          skipped++;
          skippedDetails.push({ file_id: fileId, file_name: fileName, reason: "OCR_JSON_MISSING" });
          continue;
        }
        try {
          parsed = JSON.parse(ocrJson);
        } catch (e) {
          reasonCodes.push("OCR_JSON_PARSE_ERROR");
          errors++;
          skipped++;
          skippedDetails.push({ file_id: fileId, file_name: fileName, reason: "OCR_JSON_PARSE_ERROR" });
          continue;
        }
      } else {
        reasonCodes.push("OCR_ERROR_FINAL");
        memoErr = errorCode || "ERROR_FINAL";
        if (errorDetail) reasonCodes.push("OCR_ERROR_DETAIL");
      }

      let date = "";
      if (parsed && parsed.transaction_date) {
        date = belle_yayoi_formatDate(parsed.transaction_date);
      }
      if (!date) {
        if (queuedAt) {
          date = belle_yayoi_formatDate(String(queuedAt).slice(0, 10));
        }
      }
      if (!date) {
        date = belle_yayoi_formatDate(new Date().toISOString().slice(0, 10));
      }
      if (!parsed || !parsed.transaction_date) {
        reasonCodes.push("DATE_FALLBACK");
      }

      let gross = null;
      if (parsed && parsed.receipt_total_jpy !== null && parsed.receipt_total_jpy !== undefined) {
        const n = belle_yayoi_isNumber(parsed.receipt_total_jpy);
        if (n !== null && n > 0) gross = n;
      }
      if (gross === null) {
        gross = 1;
        reasonCodes.push("AMOUNT_FALLBACK");
      }

      let rate = null;
      if (parsed) {
        const info = belle_yayoi_determineSingleRate(parsed);
        if (info && (info.rate === 8 || info.rate === 10)) rate = info.rate;
      }
      let debit = "";
      if (rate === 8 || rate === 10) {
        debit = belle_yayoi_getDebitTaxKubun(rate, parsed ? parsed.transaction_date : "");
        if (!debit) {
          debit = fallbackDebitDefault;
          reasonCodes.push("TAX_KUBUN_FALLBACK");
        }
      } else {
        debit = fallbackDebitDefault;
        reasonCodes.push("TAX_UNKNOWN");
      }

      const merchant = parsed && parsed.merchant ? String(parsed.merchant) : "unknown";
      const summary = merchant + " / fallback";
      const reasonCode = reasonCodes.length > 0 ? reasonCodes.join(";") : "OK";
      const fix = belle_yayoi_buildFallbackFixText(reasonCode);
      const shortUrl = fileId ? "https://drive.google.com/open?id=" + fileId : "";
      const memo = belle_yayoi_buildFallbackMemo({
        reasonCode: reasonCode,
        fileId: fileId,
        url: shortUrl,
        fix: fix,
        err: memoErr || errorCode
      });

      const row25 = belle_yayoi_buildRow({
        date: date,
        debitTaxKubun: debit,
        gross: String(gross),
        summary: summary,
        memo: memo
      });
      csvRows.push(belle_yayoi_buildCsvRow(row25));
      exportFileIds.push(fileId);
    }

    if (csvRows.length === 0) {
      if (skippedDetails.length > 0) {
        belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso);
      }
      const res = { phase: "EXPORT_DONE", ok: true, reason: "NO_EXPORT_ROWS", exportedRows: 0, exportedFiles: 0, skipped: skipped, errors: errors, csvFileId: "" };
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

    for (let i = 0; i < exportFileIds.length; i++) {
      importLog.appendRow([exportFileIds[i], nowIso, csvFileId]);
    }

    if (skippedDetails.length > 0) {
      belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso);
    }

    const result = {
      phase: "EXPORT_DONE",
      ok: true,
      reason: "EXPORTED",
      exportedRows: csvRows.length,
      exportedFiles: exportFileIds.length,
      skipped: skipped,
      errors: errors,
      csvFileId: csvFileId
    };
    Logger.log(result);
    return result;
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const stack = e && e.stack ? String(e.stack).split("\n")[0] : "";
    Logger.log({ phase: "EXPORT_ERROR", ok: false, errorMessage: msg, stackTop: stack });
    throw e;
  }
}

function belle_exportYayoiCsvFromReview_test() {
  return belle_exportYayoiCsvFromReview({});
}
