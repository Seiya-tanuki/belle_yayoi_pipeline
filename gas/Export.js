// @ts-check

// NOTE: Keep comments ASCII only.

function belle_getExportLogHeaderColumns() {
  return ["file_id","exported_at_iso","csv_file_id"];
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


function belle_exportLog_buildSchemaMismatchDetail_(docType, sheetName, expected, actualHeader) {
  return JSON.stringify({
    expected_required_columns: expected || [],
    actual_header: actualHeader || [],
    doc_type: String(docType || ""),
    sheet_name: String(sheetName || "")
  });
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
  const spec = belle_docType_getSpec_(docType || BELLE_DOC_TYPE_RECEIPT);
  const name = spec && spec.export_subfolder_name ? String(spec.export_subfolder_name) : (docType ? String(docType) : BELLE_DOC_TYPE_RECEIPT);
  const folders = [];
  const it = root.getFoldersByName(name);
  while (it.hasNext()) folders.push(it.next());
  const picked = belle_export_pickSingleFolder_(folders, name, docType, outputFolderId);
  if (!picked.ok) return picked;
  if (picked.folder) return { ok: true, folder: picked.folder, foundCount: picked.foundCount };
  return { ok: true, folder: root.createFolder(name), foundCount: picked.foundCount, created: true };
}

function belle_export_runDocTypesInternal_(handlers) {
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

function belle_export_getHandlersByRegistry_(options) {
  const handlers = {};
  const docTypes = belle_docType_getSupportedDocTypes_();
  const specs = [];
  for (let i = 0; i < docTypes.length; i++) {
    const spec = belle_docType_getSpec_(docTypes[i]);
    if (!spec || !spec.export_handler_key) continue;
    specs.push(spec);
  }
  specs.sort(function (a, b) {
    const aOrder = typeof a.export_order === "number" ? a.export_order : 0;
    const bOrder = typeof b.export_order === "number" ? b.export_order : 0;
    return aOrder - bOrder;
  });
  for (let i = 0; i < specs.length; i++) {
    const key = specs[i].export_handler_key;
    if (key === BELLE_DOC_TYPE_CC_STATEMENT) {
      handlers[key] = function () { return belle_exportYayoiCsvCcStatementInternal_(options); };
    } else if (key === BELLE_DOC_TYPE_BANK_STATEMENT) {
      handlers[key] = function () { return belle_exportYayoiCsvBankStatementInternal_(options); };
    } else if (key === BELLE_DOC_TYPE_RECEIPT) {
      handlers[key] = function () { return belle_exportYayoiCsvReceiptInternal_(options); };
    }
  }
  return handlers;
}

function belle_export_skeleton_buildCountsJson_(counts) {
  if (!counts) return "";
  return JSON.stringify({
    total: counts.totalCount,
    done: counts.doneCount,
    retryable: counts.errorRetryableCount,
    error_final: counts.errorFinalCount,
    queued: counts.queuedRemaining
  });
}

function belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, reason, counts, detail) {
  belle_export_appendGuardLogRow_(ss, props, {
    doc_type: docType,
    queue_sheet_name: queueSheetName,
    reason: reason,
    counts_json: belle_export_skeleton_buildCountsJson_(counts),
    detail: detail || ""
  });
}

function belle_export_skeleton_buildGuardResult_(phase, reason, docType, includeDocType) {
  const res = {
    phase: phase,
    ok: true,
    reason: reason,
    exportedRows: 0,
    exportedFiles: 0,
    skipped: 0,
    errors: 0,
    csvFileId: ""
  };
  if (includeDocType) res.doc_type = docType;
  return res;
}

function belle_export_skeleton_buildPendingGuardResult_(reason, counts, samples, docType, includeDocType) {
  const res = {
    phase: "EXPORT_GUARD",
    ok: true,
    reason: reason,
    exportedRows: 0,
    exportedFiles: 0,
    errors: 0,
    queuedRemaining: reason === "OCR_PENDING" ? counts.queuedRemaining : 0,
    doneCount: counts.doneCount,
    totalCount: counts.totalCount,
    pendingSamples: samples,
    csvFileId: ""
  };
  if (includeDocType) res.doc_type = docType;
  return res;
}

function belle_export_skeleton_runQueuePreflight_(params) {
  const ss = params.ss;
  const props = params.props;
  const docType = params.docType;
  const queueSheetName = params.queueSheetName;
  const fiscalRange = params.fiscalRange;
  const includeDocTypeInGuardResult = !!params.includeDocTypeInGuardResult;
  const includeDocTypeInStartLog = !!params.includeDocTypeInStartLog;

  if (!fiscalRange.ok) {
    belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, fiscalRange.reason || "FISCAL_RANGE_INVALID", null, "");
    const fiscalRes = belle_export_skeleton_buildGuardResult_("EXPORT_GUARD", fiscalRange.reason, docType, includeDocTypeInGuardResult);
    Logger.log(fiscalRes);
    return { ok: false, result: fiscalRes };
  }

  const queue = ss.getSheetByName(queueSheetName);
  if (!queue) {
    belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, "QUEUE_SHEET_NOT_FOUND", null, "");
    const queueMissingRes = belle_export_skeleton_buildGuardResult_("EXPORT_GUARD", "QUEUE_SHEET_NOT_FOUND", docType, includeDocTypeInGuardResult);
    Logger.log(queueMissingRes);
    return { ok: false, result: queueMissingRes };
  }

  const baseHeader = belle_getQueueHeaderColumns();
  const extraHeader = belle_getQueueLockHeaderColumns_();
  const lastRow = queue.getLastRow();
  if (lastRow < 2) {
    belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, "NO_ROWS", null, "");
    const noRowsRes = belle_export_skeleton_buildGuardResult_("EXPORT_GUARD", "NO_ROWS", docType, includeDocTypeInGuardResult);
    Logger.log(noRowsRes);
    return { ok: false, result: noRowsRes };
  }

  const headerMap = belle_queue_ensureHeaderMapCanonical_(queue, baseHeader, extraHeader);
  if (!headerMap) {
    belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, "INVALID_QUEUE_HEADER: missing required columns", null, "");
    const badHeaderRes = belle_export_skeleton_buildGuardResult_("EXPORT_GUARD", "INVALID_QUEUE_HEADER: missing required columns", docType, includeDocTypeInGuardResult);
    Logger.log(badHeaderRes);
    return { ok: false, result: badHeaderRes };
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

  const startLog = {
    phase: "EXPORT_START",
    ok: true,
    totalCount: counts.totalCount,
    doneCount: counts.doneCount,
    errorRetryableCount: counts.errorRetryableCount,
    errorFinalCount: counts.errorFinalCount,
    queuedRemaining: counts.queuedRemaining
  };
  if (includeDocTypeInStartLog) startLog.doc_type = docType;
  Logger.log(startLog);

  if (counts.queuedRemaining > 0) {
    belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, "OCR_PENDING", counts, "");
    const pendingRes = belle_export_skeleton_buildPendingGuardResult_("OCR_PENDING", counts, pendingSamples, docType, includeDocTypeInGuardResult);
    Logger.log(pendingRes);
    return { ok: false, result: pendingRes };
  }
  if (counts.errorRetryableCount > 0) {
    belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, "OCR_RETRYABLE_REMAINING", counts, "");
    const retryableRes = belle_export_skeleton_buildPendingGuardResult_("OCR_RETRYABLE_REMAINING", counts, retryableSamples, docType, includeDocTypeInGuardResult);
    Logger.log(retryableRes);
    return { ok: false, result: retryableRes };
  }

  return {
    ok: true,
    headerMap: headerMap,
    rows: rows
  };
}

function belle_export_skeleton_prepareExportLog_(params) {
  const ss = params.ss;
  const props = params.props;
  const docType = params.docType;
  const queueSheetName = params.queueSheetName;
  const includeDocTypeInExportLogGuardResult = !!params.includeDocTypeInExportLogGuardResult;
  const includeDocTypeInSchemaMismatchResult = !!params.includeDocTypeInSchemaMismatchResult;

  const exportLogResult = belle_getOrCreateExportLogSheet(ss);
  if (exportLogResult.guard) {
    belle_export_skeleton_logGuard_(
      ss,
      props,
      docType,
      queueSheetName,
      exportLogResult.guard.reason || "EXPORT_LOG_GUARD",
      null,
      exportLogResult.guard.message || ""
    );
    Logger.log(exportLogResult.guard);
    return {
      ok: false,
      result: belle_export_skeleton_buildGuardResult_(
        exportLogResult.guard.phase,
        exportLogResult.guard.reason,
        docType,
        includeDocTypeInExportLogGuardResult
      )
    };
  }

  const exportLog = exportLogResult.sheet;
  const exportHeader = belle_getExportLogHeaderColumns();
  const exportHeaderInfo = belle_exportLog_buildHeaderMap_(exportLog, exportHeader);
  if (!exportHeaderInfo.ok) {
    const detail = belle_exportLog_buildSchemaMismatchDetail_(docType, "EXPORT_LOG", exportHeader, exportHeaderInfo.actualHeader);
    belle_export_skeleton_logGuard_(ss, props, docType, queueSheetName, "EXPORT_LOG_SCHEMA_MISMATCH", null, detail);
    const schemaRes = belle_export_skeleton_buildGuardResult_("EXPORT_GUARD", "EXPORT_LOG_SCHEMA_MISMATCH", docType, includeDocTypeInSchemaMismatchResult);
    Logger.log(schemaRes);
    return { ok: false, result: schemaRes };
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

  return {
    ok: true,
    exportLog: exportLog,
    exportLogHeaderMap: exportLogHeaderMap,
    importSet: importSet
  };
}

function belle_export_skeleton_createRuntimeState_(ss, skipLogSheetName) {
  const state = {
    csvRows: [],
    exportFileIds: [],
    skipped: 0,
    errors: 0,
    processed: new Set(),
    skippedDetails: [],
    nowIso: new Date().toISOString(),
    logChunkSize: 200,
    skipFlushThreshold: 200
  };
  state.flushSkipDetails = function () {
    if (state.skippedDetails.length >= state.skipFlushThreshold) {
      belle_appendSkipLogRows(ss, skipLogSheetName, state.skippedDetails, state.nowIso, "EXPORT_SKIP");
      state.skippedDetails.length = 0;
    }
  };
  return state;
}

function belle_export_skeleton_finalizeExport_(params) {
  const runtime = params.runtime;
  const docType = params.docType;
  const outputFolderId = params.outputFolderId;
  const encodingMode = params.encodingMode;
  const eolMode = params.eolMode;
  const filenamePrefix = params.filenamePrefix;
  const exportLog = params.exportLog;
  const exportLogHeaderMap = params.exportLogHeaderMap;
  const includeDocTypeInNoRowsResult = !!params.includeDocTypeInNoRowsResult;
  const includeDocTypeInDoneResult = !!params.includeDocTypeInDoneResult;
  const ss = params.ss;
  const skipLogSheetName = params.skipLogSheetName;

  if (runtime.csvRows.length === 0) {
    if (runtime.skippedDetails.length > 0) {
      belle_appendSkipLogRows(ss, skipLogSheetName, runtime.skippedDetails, runtime.nowIso, "EXPORT_SKIP");
    }
    const noRowsRes = {
      phase: "EXPORT_DONE",
      ok: true,
      reason: "NO_EXPORT_ROWS",
      exportedRows: 0,
      exportedFiles: 0,
      skipped: runtime.skipped,
      errors: runtime.errors,
      csvFileId: ""
    };
    if (includeDocTypeInNoRowsResult) noRowsRes.doc_type = docType;
    Logger.log(noRowsRes);
    return noRowsRes;
  }

  const eol = eolMode === "LF" ? "\n" : "\r\n";
  const csvText = runtime.csvRows.join(eol);
  const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
  const filename = filenamePrefix + ts + ".csv";
  const blob = Utilities.newBlob("", "text/csv", filename);
  if (encodingMode === "UTF8") {
    blob.setDataFromString(csvText, "UTF-8");
  } else {
    blob.setDataFromString(csvText, "Shift_JIS");
  }

  const folderRes = belle_export_resolveOutputFolderByDocType_(outputFolderId, docType);
  if (!folderRes.ok) {
    Logger.log({
      phase: "EXPORT_GUARD",
      ok: true,
      reason: folderRes.reason,
      doc_type: docType,
      folder_name: folderRes.folderName || docType,
      found_count: folderRes.foundCount || 0,
      parent_folder_id: folderRes.parentFolderId || outputFolderId
    });
    return {
      phase: "EXPORT_GUARD",
      ok: true,
      reason: folderRes.reason,
      doc_type: docType,
      exportedRows: 0,
      exportedFiles: 0,
      skipped: runtime.skipped,
      errors: runtime.errors,
      csvFileId: ""
    };
  }

  const file = folderRes.folder.createFile(blob);
  const csvFileId = file.getId();

  belle_export_flushExportLog_(
    exportLog,
    runtime.exportFileIds,
    runtime.nowIso,
    csvFileId,
    runtime.logChunkSize,
    exportLogHeaderMap
  );

  if (runtime.skippedDetails.length > 0) {
    belle_appendSkipLogRows(ss, skipLogSheetName, runtime.skippedDetails, runtime.nowIso, "EXPORT_SKIP");
  }

  const result = {
    phase: "EXPORT_DONE",
    ok: true,
    reason: "EXPORTED",
    exportedRows: runtime.csvRows.length,
    exportedFiles: runtime.exportFileIds.length,
    skipped: runtime.skipped,
    errors: runtime.errors,
    csvFileId: csvFileId
  };
  if (includeDocTypeInDoneResult) result.doc_type = docType;
  Logger.log(result);
  return result;
}


function belle_exportYayoiCsvInternal_(options) {
  const handlers = belle_export_getHandlersByRegistry_(options);
  const results = belle_export_runDocTypesInternal_(handlers);
  const ccWrap = results[BELLE_DOC_TYPE_CC_STATEMENT];
  const bankWrap = results[BELLE_DOC_TYPE_BANK_STATEMENT];
  const receiptWrap = results[BELLE_DOC_TYPE_RECEIPT];
  if (ccWrap && ccWrap.ok === false) {
    Logger.log({ phase: "EXPORT_DOC_ERROR", ok: false, doc_type: BELLE_DOC_TYPE_CC_STATEMENT, errorMessage: ccWrap.errorMessage || "", stackTop: ccWrap.stackTop || "" });
  }
  if (bankWrap && bankWrap.ok === false) {
    Logger.log({ phase: "EXPORT_DOC_ERROR", ok: false, doc_type: BELLE_DOC_TYPE_BANK_STATEMENT, errorMessage: bankWrap.errorMessage || "", stackTop: bankWrap.stackTop || "" });
  }
  if (receiptWrap && receiptWrap.ok === false) {
    Logger.log({ phase: "EXPORT_DOC_ERROR", ok: false, doc_type: BELLE_DOC_TYPE_RECEIPT, errorMessage: receiptWrap.errorMessage || "", stackTop: receiptWrap.stackTop || "" });
  }
  const ccResult = ccWrap && ccWrap.ok ? ccWrap.result : null;
  const bankResult = bankWrap && bankWrap.ok ? bankWrap.result : null;
  const receiptResult = receiptWrap && receiptWrap.ok ? receiptWrap.result : null;
  if (receiptResult) {
    if (ccResult) receiptResult[BELLE_DOC_TYPE_CC_STATEMENT] = ccResult;
    if (bankResult) receiptResult[BELLE_DOC_TYPE_BANK_STATEMENT] = bankResult;
    return receiptResult;
  }
  if (bankResult) {
    if (ccResult) bankResult[BELLE_DOC_TYPE_CC_STATEMENT] = ccResult;
    return bankResult;
  }
  if (ccResult) return ccResult;
  return { phase: "EXPORT_ERROR", ok: false, reason: "EXPORT_DOC_ERROR", errors: results };
}

function belle_exportYayoiCsvReceiptInternal_(options) {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrThrow_(props);
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_RECEIPT);
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
    const fiscalRange = belle_yayoi_validateFiscalRange(fiscalStart, fiscalEnd);
    const preflight = belle_export_skeleton_runQueuePreflight_({
      ss: ss,
      props: props,
      docType: BELLE_DOC_TYPE_RECEIPT,
      queueSheetName: queueSheetName,
      fiscalRange: fiscalRange,
      includeDocTypeInGuardResult: false,
      includeDocTypeInStartLog: false
    });
    if (!preflight.ok) return preflight.result;

    const headerMap = preflight.headerMap;
    const rows = preflight.rows;

    const exportLogSetup = belle_export_skeleton_prepareExportLog_({
      ss: ss,
      props: props,
      docType: BELLE_DOC_TYPE_RECEIPT,
      queueSheetName: queueSheetName,
      includeDocTypeInExportLogGuardResult: false,
      includeDocTypeInSchemaMismatchResult: true
    });
    if (!exportLogSetup.ok) return exportLogSetup.result;

    const exportLog = exportLogSetup.exportLog;
    const exportLogHeaderMap = exportLogSetup.exportLogHeaderMap;
    const importSet = exportLogSetup.importSet;

    const runtime = belle_export_skeleton_createRuntimeState_(ss, skipLogSheetName);
    const csvRows = runtime.csvRows;
    const exportFileIds = runtime.exportFileIds;
    let skipped = runtime.skipped;
    let errors = runtime.errors;
    const processed = runtime.processed;
    const skippedDetails = runtime.skippedDetails;
    const flushSkipDetails = runtime.flushSkipDetails;

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

      if (docType && docType !== BELLE_DOC_TYPE_RECEIPT) {
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

    runtime.skipped = skipped;
    runtime.errors = errors;
    return belle_export_skeleton_finalizeExport_({
      runtime: runtime,
      docType: BELLE_DOC_TYPE_RECEIPT,
      outputFolderId: outputFolderId,
      encodingMode: encodingMode,
      eolMode: eolMode,
      filenamePrefix: "belle_yayoi_receipt_export_",
      exportLog: exportLog,
      exportLogHeaderMap: exportLogHeaderMap,
      includeDocTypeInNoRowsResult: false,
      includeDocTypeInDoneResult: false,
      ss: ss,
      skipLogSheetName: skipLogSheetName
    });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const stack = e && e.stack ? String(e.stack).split("\n")[0] : "";
    Logger.log({ phase: "EXPORT_ERROR", ok: false, errorMessage: msg, stackTop: stack });
    throw e;
  }
}

function belle_exportYayoiCsvBankStatementInternal_(options) {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrEmpty_(props);
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_BANK_STATEMENT);
  const outputFolderId = belle_cfg_getOutputFolderIdOrDriveFolderId_(props);
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  const fiscalStart = props.getProperty("BELLE_FISCAL_START_DATE");
  const fiscalEnd = props.getProperty("BELLE_FISCAL_END_DATE");
  const skipLogSheetName = belle_getSkipLogSheetName(props);

  const ss = SpreadsheetApp.openById(sheetId);
  try {
    const fiscalRange = belle_yayoi_parseFiscalRangeAllowCrossYear_(fiscalStart, fiscalEnd);
    const preflight = belle_export_skeleton_runQueuePreflight_({
      ss: ss,
      props: props,
      docType: BELLE_DOC_TYPE_BANK_STATEMENT,
      queueSheetName: queueSheetName,
      fiscalRange: fiscalRange,
      includeDocTypeInGuardResult: true,
      includeDocTypeInStartLog: true
    });
    if (!preflight.ok) return preflight.result;

    const headerMap = preflight.headerMap;
    const rows = preflight.rows;

    const exportLogSetup = belle_export_skeleton_prepareExportLog_({
      ss: ss,
      props: props,
      docType: BELLE_DOC_TYPE_BANK_STATEMENT,
      queueSheetName: queueSheetName,
      includeDocTypeInExportLogGuardResult: true,
      includeDocTypeInSchemaMismatchResult: true
    });
    if (!exportLogSetup.ok) return exportLogSetup.result;

    const exportLog = exportLogSetup.exportLog;
    const exportLogHeaderMap = exportLogSetup.exportLogHeaderMap;
    const importSet = exportLogSetup.importSet;

    const runtime = belle_export_skeleton_createRuntimeState_(ss, skipLogSheetName);
    const csvRows = runtime.csvRows;
    const exportFileIds = runtime.exportFileIds;
    let skipped = runtime.skipped;
    let errors = runtime.errors;
    const processed = runtime.processed;
    const skippedDetails = runtime.skippedDetails;
    const flushSkipDetails = runtime.flushSkipDetails;

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

      if (docType && docType !== BELLE_DOC_TYPE_BANK_STATEMENT) {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "DOC_TYPE_NOT_BANK_STATEMENT" });
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

      const valid = belle_ocr_validateBankStatement_(parsed);
      if (!valid.ok) {
        errors++;
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "BANK_INVALID_SCHEMA:" + valid.reason });
        flushSkipDetails();
        continue;
      }

      const built = belle_yayoi_buildBankRowsFromStage2_(parsed, { fileId: fileId, fileName: fileName, docType: BELLE_DOC_TYPE_BANK_STATEMENT }, fiscalRange);
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
            reason: sd.reason || "BANK_ROW_SKIPPED",
            detail: sd.detail || ""
          });
          flushSkipDetails();
        }
      }

      if (!built.rows || built.rows.length === 0) {
        skipped++;
        skippedDetails.push({ file_id: fileId, file_name: fileName, drive_url: driveUrl, doc_type: docType, source_subfolder: sourceSubfolder, reason: "BANK_NO_EXPORT_ROWS" });
        flushSkipDetails();
        continue;
      }

      if (csvRows.length + built.rows.length > batchMaxRows) break;
      for (let j = 0; j < built.rows.length; j++) {
        csvRows.push(belle_yayoi_buildCsvRow(built.rows[j]));
      }
      exportFileIds.push(fileId);
    }

    runtime.skipped = skipped;
    runtime.errors = errors;
    return belle_export_skeleton_finalizeExport_({
      runtime: runtime,
      docType: BELLE_DOC_TYPE_BANK_STATEMENT,
      outputFolderId: outputFolderId,
      encodingMode: encodingMode,
      eolMode: eolMode,
      filenamePrefix: "belle_yayoi_" + BELLE_DOC_TYPE_BANK_STATEMENT + "_export_",
      exportLog: exportLog,
      exportLogHeaderMap: exportLogHeaderMap,
      includeDocTypeInNoRowsResult: true,
      includeDocTypeInDoneResult: true,
      ss: ss,
      skipLogSheetName: skipLogSheetName
    });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const stack = e && e.stack ? String(e.stack).split("\n")[0] : "";
    Logger.log({ phase: "EXPORT_ERROR", ok: false, doc_type: BELLE_DOC_TYPE_BANK_STATEMENT, errorMessage: msg, stackTop: stack });
    throw e;
  }
}

function belle_exportYayoiCsvCcStatementInternal_(options) {
  const props = belle_cfg_getProps_();
  const sheetId = belle_cfg_getSheetIdOrEmpty_(props);
  const queueSheetName = belle_ocr_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_CC_STATEMENT);
  const outputFolderId = belle_cfg_getOutputFolderIdOrDriveFolderId_(props);
  const encodingMode = String(props.getProperty("BELLE_CSV_ENCODING") || "SHIFT_JIS").toUpperCase();
  const eolMode = String(props.getProperty("BELLE_CSV_EOL") || "CRLF").toUpperCase();
  const batchMaxRows = Number(props.getProperty("BELLE_EXPORT_BATCH_MAX_ROWS") || "5000");
  const fiscalStart = props.getProperty("BELLE_FISCAL_START_DATE");
  const fiscalEnd = props.getProperty("BELLE_FISCAL_END_DATE");
  const skipLogSheetName = belle_getSkipLogSheetName(props);

  const ss = SpreadsheetApp.openById(sheetId);
  try {
    const fiscalRange = belle_yayoi_parseFiscalRangeAllowCrossYear_(fiscalStart, fiscalEnd);
    const preflight = belle_export_skeleton_runQueuePreflight_({
      ss: ss,
      props: props,
      docType: BELLE_DOC_TYPE_CC_STATEMENT,
      queueSheetName: queueSheetName,
      fiscalRange: fiscalRange,
      includeDocTypeInGuardResult: true,
      includeDocTypeInStartLog: true
    });
    if (!preflight.ok) return preflight.result;

    const headerMap = preflight.headerMap;
    const rows = preflight.rows;

    const exportLogSetup = belle_export_skeleton_prepareExportLog_({
      ss: ss,
      props: props,
      docType: BELLE_DOC_TYPE_CC_STATEMENT,
      queueSheetName: queueSheetName,
      includeDocTypeInExportLogGuardResult: true,
      includeDocTypeInSchemaMismatchResult: false
    });
    if (!exportLogSetup.ok) return exportLogSetup.result;

    const exportLog = exportLogSetup.exportLog;
    const exportLogHeaderMap = exportLogSetup.exportLogHeaderMap;
    const importSet = exportLogSetup.importSet;

    const runtime = belle_export_skeleton_createRuntimeState_(ss, skipLogSheetName);
    const csvRows = runtime.csvRows;
    const exportFileIds = runtime.exportFileIds;
    let skipped = runtime.skipped;
    let errors = runtime.errors;
    const processed = runtime.processed;
    const skippedDetails = runtime.skippedDetails;
    const flushSkipDetails = runtime.flushSkipDetails;

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

      if (docType && docType !== BELLE_DOC_TYPE_CC_STATEMENT) {
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

      const built = belle_yayoi_buildCcRowsFromStage2_(parsed, { fileId: fileId, fileName: fileName, docType: BELLE_DOC_TYPE_CC_STATEMENT }, fiscalRange);
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

    runtime.skipped = skipped;
    runtime.errors = errors;
    return belle_export_skeleton_finalizeExport_({
      runtime: runtime,
      docType: BELLE_DOC_TYPE_CC_STATEMENT,
      outputFolderId: outputFolderId,
      encodingMode: encodingMode,
      eolMode: eolMode,
      filenamePrefix: "belle_yayoi_" + BELLE_DOC_TYPE_CC_STATEMENT + "_export_",
      exportLog: exportLog,
      exportLogHeaderMap: exportLogHeaderMap,
      includeDocTypeInNoRowsResult: true,
      includeDocTypeInDoneResult: true,
      ss: ss,
      skipLogSheetName: skipLogSheetName
    });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const stack = e && e.stack ? String(e.stack).split("\n")[0] : "";
    Logger.log({ phase: "EXPORT_ERROR", ok: false, doc_type: BELLE_DOC_TYPE_CC_STATEMENT, errorMessage: msg, stackTop: stack });
    throw e;
  }
}

/**
 * @deprecated Use belle_exportYayoiCsvInternal_.
 */
function belle_exportYayoiCsvInternalFromEntrypoints_(options) {
  return belle_exportYayoiCsvInternal_(options);
}

