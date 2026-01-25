// @ts-check

// NOTE: Keep comments ASCII only.

// @deprecated Use belle_queue_ensureHeaderMapCanonical_ instead.
function belle_queue_ensureHeaderMapForExport(sh, baseHeader, extraHeader, opts) {
  return belle_queue_ensureHeaderMapCanonical_(sh, baseHeader, extraHeader, opts);
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

function belle_exportLog_buildHeaderMap_(sheet, requiredHeader) {
  const lastCol = sheet.getLastColumn();
  const expected = Array.isArray(requiredHeader) ? requiredHeader : [];
  if (lastCol < 1) {
    return { ok: false, headerMap: {}, actualHeader: [], missing: expected.slice() };
  }
  const raw = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const headerMap = {};
  const actual = [];
  for (let i = 0; i < raw.length; i++) {
    const name = String(raw[i] || "");
    actual.push(name);
    headerMap[name] = i;
  }
  const missing = [];
  for (let i = 0; i < expected.length; i++) {
    if (headerMap[expected[i]] === undefined) missing.push(expected[i]);
  }
  return { ok: missing.length === 0, headerMap: headerMap, actualHeader: actual, missing: missing };
}

function belle_exportLog_buildSchemaMismatchDetail_(docType, sheetName, expected, actualHeader) {
  return JSON.stringify({
    expected_required_columns: expected || [],
    actual_header: actualHeader || [],
    doc_type: String(docType || ""),
    sheet_name: String(sheetName || "")
  });
}

function belle_exportLog_computeWidth_(headerMap) {
  let maxIdx = -1;
  const keys = Object.keys(headerMap || {});
  for (let i = 0; i < keys.length; i++) {
    const idx = Number(headerMap[keys[i]]);
    if (!isNaN(idx) && idx > maxIdx) maxIdx = idx;
  }
  return maxIdx >= 0 ? maxIdx + 1 : 0;
}

function belle_exportLog_buildRow_(headerMap, width, fileId, nowIso, csvFileId) {
  if (!headerMap || !width) return [fileId, nowIso, csvFileId];
  const row = new Array(width).fill("");
  if (headerMap.file_id !== undefined) row[headerMap.file_id] = fileId;
  if (headerMap.exported_at_iso !== undefined) row[headerMap.exported_at_iso] = nowIso;
  if (headerMap.csv_file_id !== undefined) row[headerMap.csv_file_id] = csvFileId;
  return row;
}

function belle_export_pickSingleFolder_(folders, folderName, docType, parentFolderId) {
  const list = Array.isArray(folders) ? folders : [];
  const count = list.length;
  if (count === 0) return { ok: true, folder: null, foundCount: 0 };
  if (count === 1) return { ok: true, folder: list[0], foundCount: 1 };
  return {
    ok: false,
    reason: "DUPLICATE_OUTPUT_SUBFOLDER_NAME",
    folderName: String(folderName || ""),
    docType: String(docType || ""),
    parentFolderId: String(parentFolderId || ""),
    foundCount: count
  };
}

function belle_export_resolveOutputFolderByDocType_(outputFolderId, docType) {
  const root = DriveApp.getFolderById(outputFolderId);
  const name = docType ? String(docType) : "receipt";
  const folders = [];
  const it = root.getFoldersByName(name);
  while (it.hasNext()) folders.push(it.next());
  const picked = belle_export_pickSingleFolder_(folders, name, docType, outputFolderId);
  if (!picked.ok) return picked;
  if (picked.folder) return { ok: true, folder: picked.folder, foundCount: picked.foundCount };
  return { ok: true, folder: root.createFolder(name), foundCount: picked.foundCount, created: true };
}

function belle_export_runDocTypes_(handlers) {
  const results = {};
  if (!handlers || typeof handlers !== "object") return results;
  const keys = Object.keys(handlers);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const fn = handlers[key];
    if (typeof fn !== "function") continue;
    try {
      results[key] = { ok: true, result: fn() };
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      const stack = e && e.stack ? String(e.stack).split("\n")[0] : "";
      results[key] = { ok: false, errorMessage: msg, stackTop: stack };
    }
  }
  return results;
}

function belle_export_flushExportLog_(exportLog, fileIds, nowIso, csvFileId, chunkSize, headerMap) {
  if (!exportLog || !fileIds || fileIds.length === 0) return 0;
  const sizeRaw = Number(chunkSize);
  const size = sizeRaw && isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : 200;
  const width = headerMap ? belle_exportLog_computeWidth_(headerMap) : 0;
  let written = 0;
  let buffer = [];
  for (let i = 0; i < fileIds.length; i++) {
    buffer.push(belle_exportLog_buildRow_(headerMap, width, fileIds[i], nowIso, csvFileId));
    if (buffer.length >= size) {
      written += belle_sheet_appendRowsInChunks_(exportLog, buffer, size);
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    written += belle_sheet_appendRowsInChunks_(exportLog, buffer, size);
  }
  return written;
}

function belle_exportYayoiCsvFallback(options) {
  const results = belle_export_runDocTypes_({
    cc_statement: function () { return belle_exportYayoiCsvCcStatementFallback_(options); },
    receipt: function () { return belle_exportYayoiCsvReceiptFallback_(options); }
  });
  const ccWrap = results.cc_statement;
  const receiptWrap = results.receipt;
  if (ccWrap && ccWrap.ok === false) {
    Logger.log({ phase: "EXPORT_DOC_ERROR", ok: false, doc_type: "cc_statement", errorMessage: ccWrap.errorMessage || "", stackTop: ccWrap.stackTop || "" });
  }
  if (receiptWrap && receiptWrap.ok === false) {
    Logger.log({ phase: "EXPORT_DOC_ERROR", ok: false, doc_type: "receipt", errorMessage: receiptWrap.errorMessage || "", stackTop: receiptWrap.stackTop || "" });
  }
  const ccResult = ccWrap && ccWrap.ok ? ccWrap.result : null;
  const receiptResult = receiptWrap && receiptWrap.ok ? receiptWrap.result : null;
  if (receiptResult && ccResult) {
    receiptResult.cc_statement = ccResult;
  }
  if (receiptResult) return receiptResult;
  if (ccResult) return ccResult;
  return { phase: "EXPORT_ERROR", ok: false, reason: "EXPORT_DOC_ERROR", errors: results };
}

function belle_exportYayoiCsvReceiptFallback_(options) {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrThrow_(props);
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, "receipt");
  const outputFolderId = belle_cfg_getOutputFolderIdOrDriveFolderIdOrThrow_(props);
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

  const ss = SpreadsheetApp.openById(sheetId);
  try {
    function buildCountsJson(counts) {
      if (!counts) return "";
      return JSON.stringify({
        total: counts.totalCount,
        done: counts.doneCount,
        retryable: counts.errorRetryableCount,
        error_final: counts.errorFinalCount,
        queued: counts.queuedRemaining
      });
    }
    function logGuard(reason, counts, detail) {
      belle_export_appendGuardLogRow_(ss, props, {
        doc_type: "receipt",
        queue_sheet_name: queueSheetName,
        reason: reason,
        counts_json: buildCountsJson(counts),
        detail: detail || ""
      });
    }
    const fiscalRange = belle_yayoi_validateFiscalRange(fiscalStart, fiscalEnd);
    if (!fiscalRange.ok) {
      logGuard(fiscalRange.reason || "FISCAL_RANGE_INVALID", null, "");
      const res = { phase: "EXPORT_GUARD", ok: true, reason: fiscalRange.reason, exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const queue = ss.getSheetByName(queueSheetName);
    if (!queue) {
      logGuard("QUEUE_SHEET_NOT_FOUND", null, "");
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "QUEUE_SHEET_NOT_FOUND", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }

    const baseHeader = belle_getQueueHeaderColumns_v0();
    const extraHeader = belle_getQueueLockHeaderColumns_v0_();
    const lastRow = queue.getLastRow();
    if (lastRow < 2) {
      logGuard("NO_ROWS", null, "");
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "NO_ROWS", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const headerMap = belle_queue_ensureHeaderMapCanonical_(queue, baseHeader, extraHeader);
    if (!headerMap) {
      logGuard("INVALID_QUEUE_HEADER: missing required columns", null, "");
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
      logGuard("OCR_PENDING", counts, "");
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
      logGuard("OCR_RETRYABLE_REMAINING", counts, "");
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
      logGuard(exportLogResult.guard.reason || "EXPORT_LOG_GUARD", null, exportLogResult.guard.message || "");
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
    const exportHeader = belle_getExportLogHeaderColumns_v0();
    const exportHeaderInfo = belle_exportLog_buildHeaderMap_(exportLog, exportHeader);
    if (!exportHeaderInfo.ok) {
      const detail = belle_exportLog_buildSchemaMismatchDetail_("cc_statement", "EXPORT_LOG", exportHeader, exportHeaderInfo.actualHeader);
      logGuard("EXPORT_LOG_SCHEMA_MISMATCH", null, detail);
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "EXPORT_LOG_SCHEMA_MISMATCH", doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const exportLogHeaderMap = exportHeaderInfo.headerMap;
    const importSet = new Set();
    const logRows = exportLog.getLastRow();
    if (logRows >= 2) {
      const fileIdCol = exportLogHeaderMap["file_id"];
      const vals = exportLog.getRange(2, fileIdCol + 1, logRows - 1, 1).getValues();
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
    const logChunkSize = 200;
    const skipFlushThreshold = 200;
    function flushSkipDetails() {
      if (skippedDetails.length >= skipFlushThreshold) {
        belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso, "EXPORT_SKIP");
        skippedDetails.length = 0;
      }
    }

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
        flushSkipDetails();
        continue;
      }
      if (status !== "DONE" && status !== "ERROR_FINAL") {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_NOT_DONE:" + status });
        flushSkipDetails();
        continue;
      }

      let parsed = null;
      let memoErr = "";

      if (status === "DONE") {
        if (!ocrJson) {
          errors++;
          skipped++;
          skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_MISSING" });
          flushSkipDetails();
          continue;
        }
        try {
          parsed = JSON.parse(ocrJson);
        } catch (e) {
          errors++;
          skipped++;
          skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_PARSE_ERROR" });
          flushSkipDetails();
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
    const folderRes = belle_export_resolveOutputFolderByDocType_(outputFolderId, "receipt");
    if (!folderRes.ok) {
      Logger.log({
        phase: "EXPORT_GUARD",
        ok: true,
        reason: folderRes.reason,
        doc_type: "receipt",
        folder_name: folderRes.folderName || "receipt",
        found_count: folderRes.foundCount || 0,
        parent_folder_id: folderRes.parentFolderId || outputFolderId
      });
      return {
        phase: "EXPORT_GUARD",
        ok: true,
        reason: folderRes.reason,
        doc_type: "receipt",
        exportedRows: 0,
        exportedFiles: 0,
        skipped: skipped,
        errors: errors,
        csvFileId: ""
      };
    }
    const file = folderRes.folder.createFile(blob);
    const csvFileId = file.getId();

    belle_export_flushExportLog_(exportLog, exportFileIds, nowIso, csvFileId, logChunkSize, exportLogHeaderMap);

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
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrEmpty_(props);
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, "cc_statement");
  const outputFolderId = belle_cfg_getOutputFolderIdOrDriveFolderId_(props);
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  const fiscalStart = props.getProperty("BELLE_FISCAL_START_DATE");
  const fiscalEnd = props.getProperty("BELLE_FISCAL_END_DATE");
  const skipLogSheetName = belle_getSkipLogSheetName(props);

  const ss = SpreadsheetApp.openById(sheetId);
  try {
    function buildCountsJson(counts) {
      if (!counts) return "";
      return JSON.stringify({
        total: counts.totalCount,
        done: counts.doneCount,
        retryable: counts.errorRetryableCount,
        error_final: counts.errorFinalCount,
        queued: counts.queuedRemaining
      });
    }
    function logGuard(reason, counts, detail) {
      belle_export_appendGuardLogRow_(ss, props, {
        doc_type: "cc_statement",
        queue_sheet_name: queueSheetName,
        reason: reason,
        counts_json: buildCountsJson(counts),
        detail: detail || ""
      });
    }
    const fiscalRange = belle_yayoi_parseFiscalRangeAllowCrossYear_(fiscalStart, fiscalEnd);
    if (!fiscalRange.ok) {
      logGuard(fiscalRange.reason || "FISCAL_RANGE_INVALID", null, "");
      const res = { phase: "EXPORT_GUARD", ok: true, reason: fiscalRange.reason, doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const queue = ss.getSheetByName(queueSheetName);
    if (!queue) {
      logGuard("QUEUE_SHEET_NOT_FOUND", null, "");
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "QUEUE_SHEET_NOT_FOUND", doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }

    const baseHeader = belle_getQueueHeaderColumns_v0();
    const extraHeader = belle_getQueueLockHeaderColumns_v0_();
    const lastRow = queue.getLastRow();
    if (lastRow < 2) {
      logGuard("NO_ROWS", null, "");
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "NO_ROWS", doc_type: "cc_statement", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const headerMap = belle_queue_ensureHeaderMapCanonical_(queue, baseHeader, extraHeader);
    if (!headerMap) {
      logGuard("INVALID_QUEUE_HEADER: missing required columns", null, "");
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
      logGuard("OCR_PENDING", counts, "");
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
      logGuard("OCR_RETRYABLE_REMAINING", counts, "");
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
      logGuard(exportLogResult.guard.reason || "EXPORT_LOG_GUARD", null, exportLogResult.guard.message || "");
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
    const exportHeader = belle_getExportLogHeaderColumns_v0();
    const exportHeaderInfo = belle_exportLog_buildHeaderMap_(exportLog, exportHeader);
    if (!exportHeaderInfo.ok) {
      const detail = belle_exportLog_buildSchemaMismatchDetail_("receipt", "EXPORT_LOG", exportHeader, exportHeaderInfo.actualHeader);
      logGuard("EXPORT_LOG_SCHEMA_MISMATCH", null, detail);
      const res = { phase: "EXPORT_GUARD", ok: true, reason: "EXPORT_LOG_SCHEMA_MISMATCH", exportedRows: 0, exportedFiles: 0, skipped: 0, errors: 0, csvFileId: "" };
      Logger.log(res);
      return res;
    }
    const exportLogHeaderMap = exportHeaderInfo.headerMap;
    const importSet = new Set();
    const logRows = exportLog.getLastRow();
    if (logRows >= 2) {
      const fileIdCol = exportLogHeaderMap["file_id"];
      const vals = exportLog.getRange(2, fileIdCol + 1, logRows - 1, 1).getValues();
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
    const logChunkSize = 200;
    const skipFlushThreshold = 200;
    function flushSkipDetails() {
      if (skippedDetails.length >= skipFlushThreshold) {
        belle_appendSkipLogRows(ss, skipLogSheetName, skippedDetails, nowIso, "EXPORT_SKIP");
        skippedDetails.length = 0;
      }
    }

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
        flushSkipDetails();
        continue;
      }
      if (status !== "DONE") {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_NOT_DONE:" + status });
        flushSkipDetails();
        continue;
      }

      if (!ocrJson) {
        errors++;
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_MISSING" });
        flushSkipDetails();
        continue;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(ocrJson);
      } catch (e) {
        errors++;
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "OCR_JSON_PARSE_ERROR" });
        flushSkipDetails();
        continue;
      }

      const valid = belle_ocr_validateCcStage2_(parsed);
      if (!valid.ok) {
        errors++;
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "CC_INVALID_SCHEMA:" + valid.reason });
        flushSkipDetails();
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
          flushSkipDetails();
        }
      }

      if (!built.rows || built.rows.length === 0) {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "CC_NO_DEBIT_ROWS" });
        flushSkipDetails();
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
    const folderRes = belle_export_resolveOutputFolderByDocType_(outputFolderId, "cc_statement");
    if (!folderRes.ok) {
      Logger.log({
        phase: "EXPORT_GUARD",
        ok: true,
        reason: folderRes.reason,
        doc_type: "cc_statement",
        folder_name: folderRes.folderName || "cc_statement",
        found_count: folderRes.foundCount || 0,
        parent_folder_id: folderRes.parentFolderId || outputFolderId
      });
      return {
        phase: "EXPORT_GUARD",
        ok: true,
        reason: folderRes.reason,
        doc_type: "cc_statement",
        exportedRows: 0,
        exportedFiles: 0,
        skipped: skipped,
        errors: errors,
        csvFileId: ""
      };
    }
    const file = folderRes.folder.createFile(blob);
    const csvFileId = file.getId();

    belle_export_flushExportLog_(exportLog, exportFileIds, nowIso, csvFileId, logChunkSize, exportLogHeaderMap);

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

