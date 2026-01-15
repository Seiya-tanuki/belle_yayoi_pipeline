// @ts-check

/**
 * Health check: verify script properties keys exist (do not log secrets).
 */
function belle_healthCheck() {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys();
  Logger.log({ ok: true, propertyKeys: keys, now: new Date().toISOString() });
  return { ok: true, propertyKeys: keys, now: new Date().toISOString() };
}

/**
 * Setup placeholder (DO NOT COMMIT real IDs here).
 * Configure properties via Apps Script UI (Project Settings > Script properties).
 */
function belle_setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  // Example (leave commented):
  // props.setProperties({
  //   BELLE_SHEET_ID: "",
  //   BELLE_SHEET_NAME: "OCR_RAW"
  // }, true);
  Logger.log("belle_setupScriptProperties: done");
}

/**
 * Append-only guard: append a single row to the configured sheet.
 * Requires Script Properties:
 * - BELLE_SHEET_ID
 * - BELLE_SHEET_NAME (optional; default "OCR_RAW")
 */
function belle_appendRow(values) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const sheetName = props.getProperty("BELLE_SHEET_NAME") || "OCR_RAW";

  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!Array.isArray(values)) throw new Error("values must be an array");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);

  sh.appendRow(values);
}

/**
 * Manual test runner (run in dev only).
 */
function belle_appendRow_test() {
  belle_appendRow(["TEST", new Date().toISOString(), "hello"]);
}

/**
 * List files under BELLE_DRIVE_FOLDER_ID.
 * - Filters: image/* and application/pdf
 * - Read-only. No delete/move.
 */
function belle_listFilesInFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("BELLE_DRIVE_FOLDER_ID");
  if (!folderId) throw new Error("Missing Script Property: BELLE_DRIVE_FOLDER_ID");

  const folder = DriveApp.getFolderById(folderId);
  const it = folder.getFiles();
  const files = [];

  while (it.hasNext()) {
    const f = it.next();
    const mime = f.getMimeType();
    const isImage = mime && mime.indexOf("image/") === 0;
    const isPdf = mime === "application/pdf";
    if (!isImage && !isPdf) continue;

    files.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: mime,
      createdAt: f.getDateCreated() ? f.getDateCreated().toISOString() : null,
      url: "https://drive.google.com/file/d/" + f.getId() + "/view"
    });
  }

  Logger.log({ ok: true, count: files.length });
  return { ok: true, count: files.length, files: files };
}

/**
 * Append-only queue writer:
 * Writes QUEUED rows into the configured sheet.
 *
 * Sheet properties:
 * - BELLE_SHEET_ID (required)
 * - BELLE_SHEET_NAME (required; used as default)
 * - BELLE_QUEUE_SHEET_NAME (optional; if set, used instead of BELLE_SHEET_NAME)
 *
 * Queue row schema (8 cols):
 * 1 status
 * 2 file_id
 * 3 file_name
 * 4 mime_type
 * 5 drive_url
 * 6 queued_at_iso
 * 7 ocr_json (empty for now)
 * 8 ocr_error (empty for now)
 */
function belle_queueFolderFilesToSheet() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const defaultSheetName = props.getProperty("BELLE_SHEET_NAME");
  const queueSheetName = props.getProperty("BELLE_QUEUE_SHEET_NAME") || defaultSheetName;

  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!queueSheetName) throw new Error("Missing Script Property: BELLE_SHEET_NAME (or BELLE_QUEUE_SHEET_NAME)");

  const listed = belle_listFilesInFolder();
  const files = listed.files || [];

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(queueSheetName);
  if (!sh) throw new Error("Sheet not found: " + queueSheetName);

  const header = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
  }

  const existing = new Set();
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const vals = sh.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i][0];
      if (v) existing.add(String(v));
    }
  }

  const nowIso = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || !f.id) continue;
    if (existing.has(String(f.id))) continue;
    rows.push([
      "QUEUED",
      String(f.id),
      String(f.name || ""),
      String(f.mimeType || ""),
      String(f.url || ""),
      nowIso,
      "",
      ""
    ]);
  }

  if (rows.length > 0) {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rows.length, header.length).setValues(rows);
  }

  const result = {
    ok: true,
    queued: rows.length,
    skipped: files.length - rows.length,
    totalListed: files.length
  };
  Logger.log(result);
  return result;
}

/**
 * Manual test runner (dev only).
 * Run this from the Apps Script editor.
 */
function belle_queueFolderFilesToSheet_test() {
  return belle_queueFolderFilesToSheet();
}

/**
 * Read required properties for Gemini call.
 * Required:
 * - BELLE_GEMINI_API_KEY
 * - BELLE_GEMINI_MODEL (example: "gemini-2.0-flash" or your working model name)
 * Optional:
 * - BELLE_GEMINI_SLEEP_MS (default 500)
 * - BELLE_MAX_ITEMS_PER_RUN (default 1)
 */
function belle_getGeminiConfig() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("BELLE_GEMINI_API_KEY");
  const model = props.getProperty("BELLE_GEMINI_MODEL");
  const sleepMs = Number(props.getProperty("BELLE_GEMINI_SLEEP_MS") || "500");
  const maxItems = Number(props.getProperty("BELLE_MAX_ITEMS_PER_RUN") || "1");
  if (!apiKey) throw new Error("Missing Script Property: BELLE_GEMINI_API_KEY");
  if (!model) throw new Error("Missing Script Property: BELLE_GEMINI_MODEL");
  return { apiKey: apiKey, model: model, sleepMs: sleepMs, maxItems: maxItems };
}

/**
 * Call Gemini generateContent with image inline data.
 * NOTE: Endpoint may vary by your setup. This uses Generative Language API style.
 */
function belle_callGeminiOcr(imageBlob) {
  const cfg = belle_getGeminiConfig();
  const prompt = (typeof BELLE_OCR_PROMPT_V0 !== "undefined") ? BELLE_OCR_PROMPT_V0 : "";
  if (!prompt) throw new Error("Missing OCR prompt constant: BELLE_OCR_PROMPT_V0");

  const mimeType = imageBlob.getContentType();
  const b64 = Utilities.base64Encode(imageBlob.getBytes());
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(cfg.model) + ":generateContent?key=" + encodeURIComponent(cfg.apiKey);

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: b64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.0
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const text = res.getContentText() || "";
  if (status < 200 || status >= 300) {
    throw new Error("Gemini HTTP " + status + ": " + text.slice(0, 500));
  }

  let out = text;
  try {
    const j = JSON.parse(text);
    const c = j && j.candidates && j.candidates[0] && j.candidates[0].content;
    const parts = c && c.parts;
    if (parts && parts[0] && typeof parts[0].text === "string") out = parts[0].text;
  } catch (e) {
    // keep raw text
  }

  const trimmed = String(out || "").trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    throw new Error("OCR output is not valid JSON: " + trimmed.slice(0, 200));
  }

  return JSON.stringify(parsed);
}

/**
 * Process QUEUED rows in the queue sheet.
 * Updates only these columns for the matched row:
 * - A: status (QUEUED -> PROCESSING -> DONE/ERROR/SKIPPED)
 * - G: ocr_json
 * - H: ocr_error
 */
function belle_processQueueOnce() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const defaultSheetName = props.getProperty("BELLE_SHEET_NAME");
  const queueSheetName = props.getProperty("BELLE_QUEUE_SHEET_NAME") || defaultSheetName;
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!queueSheetName) throw new Error("Missing Script Property: BELLE_SHEET_NAME (or BELLE_QUEUE_SHEET_NAME)");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const cfg = belle_getGeminiConfig();

    const ss = SpreadsheetApp.openById(sheetId);
    const sh = ss.getSheetByName(queueSheetName);
    if (!sh) throw new Error("Sheet not found: " + queueSheetName);

    const header = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
    const lastRow = sh.getLastRow();
    if (lastRow < 1) {
      return { ok: false, processed: 0, reason: "QUEUE_EMPTY: sheet has no header" };
    }

    const headerRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
    for (let i = 0; i < header.length; i++) {
      if (String(headerRow[i] || "") !== header[i]) {
        return { ok: false, processed: 0, reason: "INVALID_QUEUE_HEADER: mismatch at col " + (i + 1) };
      }
    }

    if (lastRow < 2) {
      return { ok: false, processed: 0, reason: "QUEUE_EMPTY: run belle_queueFolderFilesToSheet first" };
    }

    const values = sh.getRange(2, 1, lastRow - 1, 8).getValues();
    let processed = 0;
    let scanned = 0;
    const processedRows = [];

    for (let i = 0; i < values.length; i++) {
      if (processed >= cfg.maxItems) break;
      scanned++;

      const row = values[i];
      const status = String(row[0] || "");
      const fileId = String(row[1] || "");
      const fileName = String(row[2] || "");
      const mimeType = String(row[3] || "");
      const ocrJson = String(row[6] || "");
      const ocrErr = String(row[7] || "");

      if (!fileId) continue;
      if (status !== "QUEUED") continue;
      if (ocrJson) continue;
      if (ocrErr) continue;

      const sheetRow = i + 2;
      sh.getRange(sheetRow, 1).setValue("PROCESSING");

      try {
        if (mimeType === "application/pdf") {
          sh.getRange(sheetRow, 1).setValue("SKIPPED");
          sh.getRange(sheetRow, 8).setValue("PDF not supported in v0");
          processedRows.push(sheetRow);
          processed++;
          continue;
        }

        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        const jsonStr = belle_callGeminiOcr(blob);
        const MAX_CELL_CHARS = 45000;
        if (jsonStr.length > MAX_CELL_CHARS) {
          throw new Error("OCR JSON too long for single cell: " + jsonStr.length);
        }

        sh.getRange(sheetRow, 7).setValue(jsonStr);
        sh.getRange(sheetRow, 8).setValue("");
        sh.getRange(sheetRow, 1).setValue("DONE");
        processedRows.push(sheetRow);
        processed++;

        if (cfg.sleepMs > 0) Utilities.sleep(cfg.sleepMs);
      } catch (e) {
        sh.getRange(sheetRow, 8).setValue(String(e && e.message ? e.message : e).slice(0, 500));
        sh.getRange(sheetRow, 1).setValue("ERROR");
        processedRows.push(sheetRow);
        processed++;
      }
    }

    const result = {
      ok: true,
      processed: processed,
      scanned: scanned,
      maxItems: cfg.maxItems,
      processedRows: processedRows
    };
    Logger.log(result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Manual test runner (dev only).
 */
function belle_processQueueOnce_test() {
  return belle_processQueueOnce();
}

/**
 * Export DONE rows to Yayoi CSV and save to Drive.
 * - No header in CSV
 * - Append-only for IMPORT_LOG
 */
function belle_exportYayoiCsvFromDoneRows() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("BELLE_SHEET_ID");
  const defaultSheetName = props.getProperty("BELLE_SHEET_NAME");
  const queueSheetName = props.getProperty("BELLE_QUEUE_SHEET_NAME") || defaultSheetName;
  const outputFolderId = props.getProperty("BELLE_OUTPUT_FOLDER_ID") || props.getProperty("BELLE_DRIVE_FOLDER_ID");
  const logSheetName = props.getProperty("BELLE_IMPORT_LOG_SHEET_NAME") || "IMPORT_LOG";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!queueSheetName) throw new Error("Missing Script Property: BELLE_SHEET_NAME (or BELLE_QUEUE_SHEET_NAME)");
  if (!outputFolderId) throw new Error("Missing Script Property: BELLE_OUTPUT_FOLDER_ID (or BELLE_DRIVE_FOLDER_ID)");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sh = ss.getSheetByName(queueSheetName);
    if (!sh) throw new Error("Sheet not found: " + queueSheetName);

    const header = ["status","file_id","file_name","mime_type","drive_url","queued_at_iso","ocr_json","ocr_error"];
    const lastRow = sh.getLastRow();
    if (lastRow < 1) {
      return { ok: false, exportedRows: 0, reason: "QUEUE_EMPTY: sheet has no header" };
    }

    const headerRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
    for (let i = 0; i < header.length; i++) {
      if (String(headerRow[i] || "") !== header[i]) {
        return { ok: false, exportedRows: 0, reason: "INVALID_QUEUE_HEADER: mismatch at col " + (i + 1) };
      }
    }

    if (lastRow < 2) {
      return { ok: false, exportedRows: 0, reason: "QUEUE_EMPTY: no DONE rows" };
    }

    let logSheet = ss.getSheetByName(logSheetName);
    if (!logSheet) logSheet = ss.insertSheet(logSheetName);
    const logHeader = ["file_id","exported_at_iso","csv_file_id"];
    const logLastRow = logSheet.getLastRow();
    if (logLastRow === 0) {
      logSheet.appendRow(logHeader);
    } else {
      const logHeaderRow = logSheet.getRange(1, 1, 1, logHeader.length).getValues()[0];
      for (let i = 0; i < logHeader.length; i++) {
        if (String(logHeaderRow[i] || "") !== logHeader[i]) {
          return { ok: false, exportedRows: 0, reason: "INVALID_IMPORT_LOG_HEADER: mismatch at col " + (i + 1) };
        }
      }
    }

    const loggedIds = new Set();
    const logRows = logSheet.getLastRow();
    if (logRows >= 2) {
      const vals = logSheet.getRange(2, 1, logRows - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i][0];
        if (v) loggedIds.add(String(v));
      }
    }

    const values = sh.getRange(2, 1, lastRow - 1, 8).getValues();
    const csvRows = [];
    const exportedFileIds = new Set();
    const skipped = [];
    const errors = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const status = String(row[0] || "");
      const fileId = String(row[1] || "");
      const fileName = String(row[2] || "");
      const driveUrl = String(row[4] || "");
      const ocrJson = String(row[6] || "");

      if (!fileId) continue;
      if (status !== "DONE") continue;
      if (loggedIds.has(fileId)) continue;
      if (!ocrJson) {
        errors.push({ fileId: fileId, reason: "EMPTY_OCR_JSON" });
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(ocrJson);
      } catch (e) {
        errors.push({ fileId: fileId, reason: "INVALID_OCR_JSON" });
        continue;
      }

      const date = belle_yayoi_formatDate(parsed.transaction_date);
      if (!date) {
        errors.push({ fileId: fileId, reason: "MISSING_DATE" });
        continue;
      }

      const merchant = parsed.merchant ? String(parsed.merchant) : "unknown";
      const docType = parsed.document_type ? String(parsed.document_type) : "unknown";
      const summary = merchant + " / " + docType;

      let memo = (driveUrl + " " + fileId).trim();
      if (memo.length > 200) memo = memo.slice(0, 200);

      const rate10 = parsed.tax_breakdown && parsed.tax_breakdown.rate_10;
      const rate8 = parsed.tax_breakdown && parsed.tax_breakdown.rate_8;
      const gross10 = rate10 ? belle_yayoi_isNumber(rate10.gross_amount_jpy) : null;
      const gross8 = rate8 ? belle_yayoi_isNumber(rate8.gross_amount_jpy) : null;

      const rowsForFile = [];
      if (gross10 !== null && gross10 > 0) {
        const kubun = belle_yayoi_getDebitTaxKubun(10, parsed.transaction_date);
        if (kubun) {
          rowsForFile.push(belle_yayoi_buildRow({
            date: date,
            debitTaxKubun: kubun,
            gross: String(gross10),
            summary: summary,
            memo: memo
          }));
        } else {
          skipped.push({ fileId: fileId, reason: "UNKNOWN_TAX_KUBUN_10" });
        }
      }
      if (gross8 !== null && gross8 > 0) {
        const kubun = belle_yayoi_getDebitTaxKubun(8, parsed.transaction_date);
        if (kubun) {
          rowsForFile.push(belle_yayoi_buildRow({
            date: date,
            debitTaxKubun: kubun,
            gross: String(gross8),
            summary: summary,
            memo: memo
          }));
        } else {
          skipped.push({ fileId: fileId, reason: "UNKNOWN_TAX_KUBUN_8" });
        }
      }

      if (rowsForFile.length === 0) {
        skipped.push({ fileId: fileId, reason: "NO_GROSS_BY_RATE" });
        continue;
      }

      for (let r = 0; r < rowsForFile.length; r++) {
        csvRows.push(belle_yayoi_buildCsvRow(rowsForFile[r]));
      }
      exportedFileIds.add(fileId);
    }

    if (csvRows.length === 0) {
      return {
        ok: false,
        exportedRows: 0,
        reason: "NO_EXPORT_ROWS",
        skipped: skipped.length,
        errors: errors.length
      };
    }

    const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
    const filename = "belle_yayoi_export_" + ts + ".csv";
    const csvText = csvRows.join("\n");
    const folder = DriveApp.getFolderById(outputFolderId);
    const file = folder.createFile(Utilities.newBlob(csvText, "text/csv", filename));
    const csvFileId = file.getId();
    const nowIso = new Date().toISOString();

    exportedFileIds.forEach(function(id) {
      logSheet.appendRow([id, nowIso, csvFileId]);
    });

    const result = {
      ok: true,
      exportedRows: csvRows.length,
      exportedFiles: exportedFileIds.size,
      csvFileId: csvFileId,
      skipped: skipped.length,
      errors: errors.length
    };
    Logger.log(result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Manual test runner (dev only).
 */
function belle_exportYayoiCsvFromDoneRows_test() {
  return belle_exportYayoiCsvFromDoneRows();
}
