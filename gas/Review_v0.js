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

function belle_getOrCreateExportLogSheet(ss) {
  const EXPORT_LOG_NAME = "EXPORT_LOG";
  const LEGACY_NAME = "IMPORT_LOG";
  const existing = ss.getSheetByName(EXPORT_LOG_NAME);
  if (existing) return { sheet: existing, guard: null };

  const legacy = ss.getSheetByName(LEGACY_NAME);
  if (legacy) {
    return {
      sheet: null,
      guard: {
        phase: "EXPORT_GUARD",
        ok: true,
        reason: "EXPORT_LOG_MISSING_LEGACY_PRESENT",
        message: "Rename IMPORT_LOG to EXPORT_LOG before exporting."
      }
    };
  }

  const created = ss.insertSheet(EXPORT_LOG_NAME);
  created.appendRow(["file_id","exported_at_iso","csv_file_id"]);
  return { sheet: created, guard: null };
}

function belle_export_getOutputFolderByDocType_(outputFolderId, docType) {
  const root = DriveApp.getFolderById(outputFolderId);
  const name = docType ? String(docType) : "receipt";
  const it = root.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return root.createFolder(name);
}

function belle_exportYayoiCsvFallback(options) {
  let ccResult = null;
  try {
    ccResult = belle_exportYayoiCsvCcStatementFallback_(options);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const stack = e && e.stack ? String(e.stack).split("\n")[0] : "";
    Logger.log({ phase: "EXPORT_CC_ERROR", ok: false, errorMessage: msg, stackTop: stack });
  }

  const receiptResult = belle_exportYayoiCsvReceiptFallback_(options);
  if (receiptResult && ccResult) {
    receiptResult.cc_statement = ccResult;
  }
  return receiptResult;
}

function belle_exportYayoiCsvReceiptFallback_(options) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, "receipt");
  const outputFolderId = belle_getOutputFolderId(props);
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  const appendInvoiceSuffix = belle_parseBool(props.getProperty("BELLE_FALLBACK_APPEND_INVOICE_SUFFIX"), true);
  // Default label must be a plain value (no extra description).
  const fallbackDebitDefault = String(props.getProperty("BELLE_FALLBACK_DEBIT_TAX_KUBUN_DEFAULT") || "対象外");
  const errorFinalTekiyoLabel = String(props.getProperty("BELLE_ERROR_FINAL_TEKIYO_LABEL") || "BELLE");
  const fiscalStart = props.getProperty("BELLE_FISCAL_START_DATE");
  const fiscalEnd = props.getProperty("BELLE_FISCAL_END_DATE");
  const skipLogSheetName = belle_getSkipLogSheetName(props);
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!outputFolderId) throw new Error("Missing Script Property: BELLE_OUTPUT_FOLDER_ID (or BELLE_DRIVE_FOLDER_ID)");

  const ss = SpreadsheetApp.openById(sheetId);
  try {
    const fiscalRange = belle_yayoi_validateFiscalRange(fiscalStart, fiscalEnd);
    if (!fiscalRange.ok) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: fiscalRange.reason, exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const queue = ss.getSheetByName(queueSheetName);
    if (!queue) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "QUEUE_SHEET_NOT_FOUND", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }

    const baseHeader = belle_getQueueHeaderColumns_v0();
    const extraHeader = belle_getQueueLockHeaderColumns_v0_();
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

    const exportLogResult = belle_getOrCreateExportLogSheet(ss);
    if (exportLogResult.guard) {
      Logger.log(exportLogResult.guard);
      return {
        phase: exportLogResult.guard.phase,
        ok: true,
        reason: exportLogResult.guard.reason,
        exportedRows: 0,
        exportedFiles: 0,
        skipped: 0,
        errors: 0,
        csvFileId: ""
      };
    }
    const exportLog = exportLogResult.sheet;
    const importSet = new Set();
    const logRows = exportLog.getLastRow();
    if (logRows >= 2) {
      const vals = exportLog.getRange(2, 1, logRows - 1, 1).getValues();
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
      const docType = String(row[headerMap["doc_type"]] || "");
      const sourceSubfolder = String(row[headerMap["source_subfolder"]] || "");
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

      if (docType && docType !== "receipt") {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "DOC_TYPE_NOT_RECEIPT" });
        continue;
      }
      if (status !== "DONE" && status !== "ERROR_FINAL") {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_NOT_DONE:" + status });
        continue;
      }

      let parsed = null;
      let memoErr = "";

      if (status === "DONE") {
        if (!ocrJson) {
          errors++;
          skipped++;
          skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_MISSING" });
          continue;
        }
        try {
          parsed = JSON.parse(ocrJson);
        } catch (e) {
          errors++;
          skipped++;
          skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_PARSE_ERROR" });
          continue;
        }
      } else {
        memoErr = errorCode || "ERROR_FINAL";
      }

      const rateInfo = parsed ? belle_yayoi_determineSingleRate(parsed) : { rate: null, inferred: false, reason: "OCR_ERROR_FINAL", method: "ERROR_FINAL" };
      let debit = "";
      if (rateInfo.rate === 8 || rateInfo.rate === 10) {
        debit = belle_yayoi_getDebitTaxKubunFallback(rateInfo.rate, parsed ? parsed.transaction_date : "", parsed, appendInvoiceSuffix);
      }
      if (!debit) {
        debit = fallbackDebitDefault;
      }

      let rid = "OK";
      let fix = "";
      let dtCode = "";
      let dmFlag = false;
      if (status === "ERROR_FINAL") {
        rid = "OCR_ERROR_FINAL";
        fix = "OCRエラー要確認";
      } else {
        const ridInfo = belle_yayoi_pickRidAndFix(parsed, rateInfo);
        rid = ridInfo.rid;
        fix = ridInfo.fix;
        if ((rid === "OK" || rid === "TAX_INFERRED") && !debit) {
          rid = "TAX_UNKNOWN";
          if (!fix) fix = "税率/税区分要確認";
        }
      }

      if (status === "ERROR_FINAL") {
        fix = "全データ確認";
        dmFlag = true;
      }

      let summary = belle_yayoi_buildSummary(parsed);
      if (status === "ERROR_FINAL") {
        summary = belle_yayoi_buildSummaryWithLabel(parsed, errorFinalTekiyoLabel);
      }
      Logger.log({ phase: "TAX_RATE_METHOD", file_id: fileId, method: rateInfo.method || "UNKNOWN", reason: rateInfo.reason || "" });

      const dateInfo = belle_yayoi_resolveTransactionDate(parsed, fiscalRange);
      let date = dateInfo.dateYmdSlash;
      if (dateInfo.dateRid) {
        rid = dateInfo.dateRid;
        fix = dateInfo.dateFix;
        dtCode = dateInfo.dateDt;
        Logger.log({ phase: "DATE_FALLBACK", file_id: fileId, original_date: dateInfo.original, resolved_date: date, dt_code: dtCode });
      }
      if (dmFlag) {
        rid = "OCR_ERROR_FINAL";
        fix = "全データ確認";
      }

      let gross = null;
      if (parsed && parsed.receipt_total_jpy !== null && parsed.receipt_total_jpy !== undefined) {
        const n = belle_yayoi_isNumber(parsed.receipt_total_jpy);
        if (n !== null && n > 0) gross = n;
      }
      if (gross === null) {
        gross = 1;
        if (!fix && rid === "OK") {
          rid = "AMOUNT_FALLBACK";
          fix = "金額要確認";
        }
      }

      const memo = belle_yayoi_buildFallbackMemo({
        reasonCode: rid,
        fileId: fileId,
        fileName: fileName,
        fix: fix,
        dtCode: dtCode,
        err: memoErr || errorCode,
        dm: dmFlag
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
        belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso, "EXPORT_SKIP");
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
    const outputFolder = belle_export_getOutputFolderByDocType_(outputFolderId, "receipt");
    const file = outputFolder.createFile(blob);
    const csvFileId = file.getId();

    for (let i = 0; i < exportFileIds.length; i++) {
      exportLog.appendRow([exportFileIds[i], nowIso, csvFileId]);
    }

    if (skippedDetails.length > 0) {
      belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso, "EXPORT_SKIP");
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

function belle_exportYayoiCsvCcStatementFallback_(options) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, "cc_statement");
  const outputFolderId = belle_getOutputFolderId(props);
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  const fiscalStart = props.getProperty("BELLE_FISCAL_START_DATE");
  const fiscalEnd = props.getProperty("BELLE_FISCAL_END_DATE");
  const skipLogSheetName = belle_getSkipLogSheetName(props);
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!outputFolderId) throw new Error("Missing Script Property: BELLE_OUTPUT_FOLDER_ID (or BELLE_DRIVE_FOLDER_ID)");

  const ss = SpreadsheetApp.openById(sheetId);
  try {
    const fiscalRange = belle_yayoi_parseFiscalRangeAllowCrossYear_(fiscalStart, fiscalEnd);
    if (!fiscalRange.ok) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: fiscalRange.reason, doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const queue = ss.getSheetByName(queueSheetName);
    if (!queue) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "QUEUE_SHEET_NOT_FOUND", doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }

    const baseHeader = belle_getQueueHeaderColumns_v0();
    const extraHeader = belle_getQueueLockHeaderColumns_v0_();
    const lastRow = queue.getLastRow();
    if (lastRow < 2) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "NO_ROWS", doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const headerMap = belle_queue_ensureHeaderMapForExport(queue, baseHeader, extraHeader);
    if (!headerMap) {
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "INVALID_QUEUE_HEADER: missing required columns", doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
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
      doc_type: "cc_statement",
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
        doc_type: "cc_statement",
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
        doc_type: "cc_statement",
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

    const exportLogResult = belle_getOrCreateExportLogSheet(ss);
    if (exportLogResult.guard) {
      Logger.log(exportLogResult.guard);
      return {
        phase: exportLogResult.guard.phase,
        ok: true,
        reason: exportLogResult.guard.reason,
        doc_type: "cc_statement",
        exportedRows: 0,
        exportedFiles: 0,
        skipped: 0,
        errors: 0,
        csvFileId: ""
      };
    }
    const exportLog = exportLogResult.sheet;
    const importSet = new Set();
    const logRows = exportLog.getLastRow();
    if (logRows >= 2) {
      const vals = exportLog.getRange(2, 1, logRows - 1, 1).getValues();
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
      const row = rows[i];
      const statusRaw = String(row[headerMap["status"]] || "");
      const status = statusRaw || "QUEUED";
      const fileId = String(row[headerMap["file_id"]] || "");
      const fileName = String(row[headerMap["file_name"]] || "");
      const docType = String(row[headerMap["doc_type"]] || "");
      const sourceSubfolder = String(row[headerMap["source_subfolder"]] || "");
      const driveUrl = String(row[headerMap["drive_url"]] || "");
      const ocrJson = String(row[headerMap["ocr_json"]] || "");
      if (!fileId) continue;
      if (processed.has(fileId)) continue;
      processed.add(fileId);
      if (importSet.has(fileId)) {
        skipped++;
        continue;
      }

      if (docType && docType !== "cc_statement") {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "DOC_TYPE_NOT_CC_STATEMENT" });
        continue;
      }
      if (status !== "DONE") {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_NOT_DONE:" + status });
        continue;
      }

      if (!ocrJson) {
        errors++;
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_MISSING" });
        continue;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(ocrJson);
      } catch (e) {
        errors++;
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_PARSE_ERROR" });
        continue;
      }

      const valid = belle_ocr_validateCcStage2_(parsed);
      if (!valid.ok) {
        errors++;
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "CC_INVALID_SCHEMA:" + valid.reason });
        continue;
      }

      const built = belle_yayoi_buildCcRowsFromStage2_(parsed, { fileId: fileId, fileName: fileName, docType: "cc_statement" }, fiscalRange);
      if (built.skipDetails && built.skipDetails.length > 0) {
        for (let j = 0; j < built.skipDetails.length; j++) {
          const sd = built.skipDetails[j] || {};
          skipped++;
          skippedDetails.push({
            file_id: fileId,
            file_name: fileName,
            drive_url: driveUrl,
            doc_type: docType,
            source_subfolder: sourceSubfolder,
            reason: sd.reason || "CC_ROW_SKIPPED",
            detail: sd.detail || ""
          });
        }
      }

      if (!built.rows || built.rows.length === 0) {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "CC_NO_DEBIT_ROWS" });
        continue;
      }

      if (csvRows.length + built.rows.length > batchMaxRows) break;
      for (let j = 0; j < built.rows.length; j++) {
        csvRows.push(belle_yayoi_buildCsvRow(built.rows[j]));
      }
      exportFileIds.push(fileId);
    }

    if (csvRows.length === 0) {
      if (skippedDetails.length > 0) {
        belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso, "EXPORT_SKIP");
      }
      const res = { phase: "EXPORT_DONE", ok: true, reason: "NO_EXPORT_ROWS", doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: skipped, errors: errors, csvFileId: "" };
      Logger.log(res);
      return res;
    }

    const eol = eolMode === "LF" ? "\n" : "\r\n";
    const csvText = csvRows.join(eol);
    const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
    const filename = "belle_yayoi_cc_statement_export_" + ts + ".csv";
    const blob = Utilities.newBlob("", "text/csv", filename);
    if (encodingMode === "UTF8") {
      blob.setDataFromString(csvText, "UTF-8");
    } else {
      blob.setDataFromString(csvText, "Shift_JIS");
    }
    const outputFolder = belle_export_getOutputFolderByDocType_(outputFolderId, "cc_statement");
    const file = outputFolder.createFile(blob);
    const csvFileId = file.getId();

    for (let i = 0; i < exportFileIds.length; i++) {
      exportLog.appendRow([exportFileIds[i], nowIso, csvFileId]);
    }

    if (skippedDetails.length > 0) {
      belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso, "EXPORT_SKIP");
    }

    const result = {
      phase: "EXPORT_DONE",
      ok: true,
      reason: "EXPORTED",
      doc_type: "cc_statement",
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
    Logger.log({ phase: "EXPORT_ERROR", ok: false, doc_type: "cc_statement", errorMessage: msg, stackTop: stack });
    throw e;
  }
}

/**
 * @deprecated Use belle_exportYayoiCsvFallback.
 */
function belle_exportYayoiCsvFromReview(options) {
  return belle_exportYayoiCsvFallback(options);
}

function belle_exportYayoiCsvFromReview_test() {
  return belle_exportYayoiCsvFallback({});
}



