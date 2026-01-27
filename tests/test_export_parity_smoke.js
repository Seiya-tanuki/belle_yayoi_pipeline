const fs = require('fs');
const vm = require('vm');

class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowIdx = this.row - 1 + r;
      const row = this.sheet.data[rowIdx] || [];
      const vals = [];
      for (let c = 0; c < this.numCols; c++) {
        const colIdx = this.col - 1 + c;
        vals.push(row[colIdx] !== undefined ? row[colIdx] : '');
      }
      out.push(vals);
    }
    return out;
  }
  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIdx = this.row - 1 + r;
      if (!this.sheet.data[rowIdx]) this.sheet.data[rowIdx] = [];
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = this.col - 1 + c;
        this.sheet.data[rowIdx][colIdx] = values[r][c];
      }
    }
    return this;
  }
  setValue(value) {
    return this.setValues([[value]]);
  }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
  }
  getName() {
    return this.name;
  }
  setName(name) {
    this.name = name;
  }
  getLastRow() {
    return this.data.length;
  }
  getLastColumn() {
    let max = 0;
    for (let i = 0; i < this.data.length; i++) {
      max = Math.max(max, this.data[i].length);
    }
    return max;
  }
  getRange(row, col, numRows, numCols) {
    return new MockRange(this, row, col, numRows, numCols);
  }
  appendRow(row) {
    this.data.push(row.slice());
    return this;
  }
  clear() {
    this.data = [];
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {};
  }
  getSheetByName(name) {
    return this.sheets[name] || null;
  }
  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets[name] = sheet;
    return sheet;
  }
}

class MockFolder {
  constructor(name) {
    this.name = name;
    this.subfolders = {};
    this.files = [];
  }
  getFoldersByName(name) {
    const list = this.subfolders[name] || [];
    let idx = 0;
    return {
      hasNext: () => idx < list.length,
      next: () => list[idx++]
    };
  }
  createFolder(name) {
    const folder = new MockFolder(name);
    if (!this.subfolders[name]) this.subfolders[name] = [];
    this.subfolders[name].push(folder);
    return folder;
  }
  createFile(blob) {
    const id = 'file_' + String(this.files.length + 1);
    const file = { getId: () => id, blob };
    this.files.push(file);
    return file;
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildSandbox(spreadsheet, folder, propsMap) {
  const code = fs.readFileSync('gas/Config.js', 'utf8') + '\n'
    + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Log.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Drive.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Code.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Queue.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Export.js', 'utf8') + '\n'
    + fs.readFileSync('gas/YayoiExport.js', 'utf8') + '\n'
    + fs.readFileSync('gas/OcrValidation.js', 'utf8') + '\n'
    + fs.readFileSync('gas/ExportEntrypoints.js', 'utf8');

  const sandbox = {
    console,
    Logger: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => propsMap[key] || ''
      })
    },
    SpreadsheetApp: {
      openById: () => spreadsheet
    },
    DriveApp: {
      getFolderById: () => folder
    },
    Utilities: {
      formatDate: () => '20250101_000000',
      newBlob: (input) => ({
        getBytes: () => Buffer.from(String(input || ''), 'utf8'),
        setDataFromString: () => {}
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

function buildRow(header, values) {
  const row = new Array(header.length).fill('');
  for (const key of Object.keys(values)) {
    const idx = header.indexOf(key);
    if (idx >= 0) row[idx] = values[key];
  }
  return row;
}

function buildProps() {
  return {
    BELLE_SHEET_ID: 'sheet1',
    BELLE_OUTPUT_FOLDER_ID: 'out1',
    BELLE_FISCAL_START_DATE: '2025-01-01',
    BELLE_FISCAL_END_DATE: '2025-12-31',
    BELLE_CSV_ENCODING: 'UTF8',
    BELLE_CSV_EOL: 'LF'
  };
}

function seedReceiptSheet(sandbox, spreadsheet, header) {
  const receipt = spreadsheet.insertSheet('OCR_RECEIPT');
  receipt.appendRow(header);
  return receipt;
}

function seedCcSheet(sandbox, spreadsheet, header, fileId, stage2Json) {
  const cc = spreadsheet.insertSheet('OCR_CC');
  cc.appendRow(header);
  cc.appendRow(buildRow(header, {
    status: 'DONE',
    file_id: fileId,
    file_name: fileId + '.pdf',
    mime_type: 'application/pdf',
    drive_url: 'https://example.invalid/' + fileId,
    queued_at_iso: '2025-01-01T00:00:00Z',
    doc_type: 'cc_statement',
    source_subfolder: 'cc_statement',
    ocr_json: stage2Json
  }));
  return cc;
}

function buildStage2Json() {
  return JSON.stringify({
    task: 'transaction_extraction',
    transactions: [
      {
        row_no: 1,
        raw_use_date_text: '7��1��',
        use_month: 7,
        use_day: 1,
        merchant: 'SHOP A',
        amount_yen: 1000,
        amount_sign: 'debit',
        issues: []
      },
      {
        row_no: 2,
        raw_use_date_text: '7��2��',
        use_month: 7,
        use_day: 2,
        merchant: 'SHOP B',
        amount_yen: 500,
        amount_sign: 'credit',
        issues: []
      }
    ]
  });
}

function setupHeaders(sandbox) {
  const baseHeader = sandbox.belle_getQueueHeaderColumns();
  const lockHeader = sandbox.belle_getQueueLockHeaderColumns_();
  return baseHeader.concat(lockHeader);
}

function runExportWithSchemaMismatch() {
  const spreadsheet = new MockSpreadsheet();
  const folder = new MockFolder('root');
  const props = buildProps();
  const sandbox = buildSandbox(spreadsheet, folder, props);

  const header = setupHeaders(sandbox);
  seedReceiptSheet(sandbox, spreadsheet, header);
  seedCcSheet(sandbox, spreadsheet, header, 'cc_mismatch', buildStage2Json());

  const exportLog = spreadsheet.insertSheet('EXPORT_LOG');
  exportLog.appendRow(['file_id']);

  const res = sandbox.belle_exportYayoiCsv({});
  expect(res && res.cc_statement, 'cc_statement result should be attached');
  expect(res.cc_statement.reason === 'EXPORT_LOG_SCHEMA_MISMATCH', 'cc export should guard on schema mismatch');
}

function runExportWithSkipLog() {
  const spreadsheet = new MockSpreadsheet();
  const folder = new MockFolder('root');
  const props = buildProps();
  const sandbox = buildSandbox(spreadsheet, folder, props);

  const header = setupHeaders(sandbox);
  seedReceiptSheet(sandbox, spreadsheet, header);
  seedCcSheet(sandbox, spreadsheet, header, 'cc_skip', buildStage2Json());

  const res = sandbox.belle_exportYayoiCsv({});
  expect(res && res.cc_statement, 'cc_statement result should be attached');

  const skipSheetName = sandbox.belle_getSkipLogSheetName({
    getProperty: (key) => props[key] || ''
  });
  const skipSheet = spreadsheet.getSheetByName(skipSheetName);
  expect(skipSheet, 'EXPORT_SKIP_LOG should exist');
  const headerRow = skipSheet.data[0];
  const reasonIdx = headerRow.indexOf('reason');
  expect(reasonIdx >= 0, 'reason column should exist');
  const reasons = skipSheet.data.slice(1).map((r) => String(r[reasonIdx] || ''));
  expect(reasons.includes('CC_CREDIT_UNSUPPORTED'), 'credit skip reason should be logged');
}

function runExportWithDedupe() {
  const spreadsheet = new MockSpreadsheet();
  const folder = new MockFolder('root');
  const props = buildProps();
  const sandbox = buildSandbox(spreadsheet, folder, props);

  const header = setupHeaders(sandbox);
  seedReceiptSheet(sandbox, spreadsheet, header);
  seedCcSheet(sandbox, spreadsheet, header, 'cc_dedupe', buildStage2Json());

  const exportLog = spreadsheet.insertSheet('EXPORT_LOG');
  const exportHeader = sandbox.belle_getExportLogHeaderColumns();
  exportLog.appendRow(exportHeader);
  exportLog.appendRow(['cc_dedupe', '2025-01-01T00:00:00Z', 'csv_1']);

  const beforeFiles = folder.files.length;
  const res = sandbox.belle_exportYayoiCsv({});
  expect(res && res.cc_statement, 'cc_statement result should be attached');
  const afterFiles = folder.files.length;
  expect(afterFiles === beforeFiles, 'dedupe should prevent new export files');

  const exportRows = exportLog.data.length;
  expect(exportRows === 2, 'export log should not append duplicate rows');
}

runExportWithSchemaMismatch();
runExportWithSkipLog();
runExportWithDedupe();

console.log('OK: test_export_parity_smoke');