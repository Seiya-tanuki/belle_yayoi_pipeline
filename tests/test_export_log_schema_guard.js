const fs = require('fs');
const vm = require('vm');

let fileCounter = 0;

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
        vals.push(row[colIdx] !== undefined ? row[colIdx] : "");
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
    const id = 'file_' + (++fileCounter);
    const file = { getId: () => id, blob };
    this.files.push(file);
    return file;
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function countFiles(folder) {
  let count = Array.isArray(folder.files) ? folder.files.length : 0;
  const keys = Object.keys(folder.subfolders || {});
  for (let i = 0; i < keys.length; i++) {
    const list = folder.subfolders[keys[i]] || [];
    for (let j = 0; j < list.length; j++) {
      count += Array.isArray(list[j].files) ? list[j].files.length : 0;
    }
  }
  return count;
}

function buildSandbox(spreadsheet, folder, props) {
  const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n'
    + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n'
    + fs.readFileSync('gas/YayoiExport_v0.js', 'utf8') + '\n'
    + fs.readFileSync('gas/OcrValidation_v0.js', 'utf8') + '\n'
    + fs.readFileSync('gas/Review_v0.js', 'utf8');
  const sandbox = {
    console,
    Logger: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => props
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

function buildQueueHeader(sandbox) {
  const base = sandbox.belle_getQueueHeaderColumns_v0();
  const extra = sandbox.belle_getQueueLockHeaderColumns_v0_();
  return base.concat(extra);
}

function buildRow(header, values) {
  const row = new Array(header.length).fill('');
  for (const key of Object.keys(values)) {
    const idx = header.indexOf(key);
    if (idx >= 0) row[idx] = values[key];
  }
  return row;
}

// Test 1: EXPORT_LOG schema mismatch should guard and block export.
{
  const sheet = new MockSpreadsheet();
  const folder = new MockFolder('root');
  const props = {
    getProperty: (key) => {
      if (key === 'BELLE_SHEET_ID') return 'SHEET_ID';
      if (key === 'BELLE_OUTPUT_FOLDER_ID') return 'OUT_ID';
      if (key === 'BELLE_FISCAL_START_DATE') return '2025-01-01';
      if (key === 'BELLE_FISCAL_END_DATE') return '2025-12-31';
      return '';
    }
  };
  const sandbox = buildSandbox(sheet, folder, props);
  const header = buildQueueHeader(sandbox);
  const receiptSheet = sheet.insertSheet('OCR_RECEIPT');
  receiptSheet.appendRow(header);
  receiptSheet.appendRow(buildRow(header, {
    status: 'DONE',
    file_id: 'r1',
    file_name: 'r1.jpg',
    mime_type: 'image/jpeg',
    drive_url: 'https://example.com/r1',
    queued_at_iso: '2025-01-01T00:00:00Z',
    doc_type: 'receipt',
    source_subfolder: 'receipt',
    ocr_json: JSON.stringify({
      receipt_total_jpy: 1000,
      merchant: 'SHOP R',
      transaction_date: '2025-04-01'
    })
  }));

  const exportLog = sheet.insertSheet('EXPORT_LOG');
  exportLog.appendRow(['file_id']);

  const res = sandbox.belle_exportYayoiCsvFallback({});
  expect(res && res.reason === 'EXPORT_LOG_SCHEMA_MISMATCH', 'should guard on export log schema mismatch');
  expect(countFiles(folder) === 0, 'no CSV should be created on guard');

  const guardSheet = sheet.getSheetByName('EXPORT_GUARD_LOG');
  expect(guardSheet, 'EXPORT_GUARD_LOG should be created');
  const guardHeader = sandbox.belle_getExportGuardLogHeader_();
  const reasonIdx = guardHeader.indexOf('reason');
  const docTypeIdx = guardHeader.indexOf('doc_type');
  let found = false;
  for (let i = 1; i < guardSheet.data.length; i++) {
    const row = guardSheet.data[i] || [];
    if (row[reasonIdx] === 'EXPORT_LOG_SCHEMA_MISMATCH' && row[docTypeIdx] === 'receipt') {
      found = true;
      break;
    }
  }
  expect(found, 'guard reason mismatch');
}

// Test 2: EXPORT_LOG with extra columns should still dedupe by file_id.
{
  const sheet = new MockSpreadsheet();
  const folder = new MockFolder('root');
  const props = {
    getProperty: (key) => {
      if (key === 'BELLE_SHEET_ID') return 'SHEET_ID';
      if (key === 'BELLE_OUTPUT_FOLDER_ID') return 'OUT_ID';
      if (key === 'BELLE_FISCAL_START_DATE') return '2025-01-01';
      if (key === 'BELLE_FISCAL_END_DATE') return '2025-12-31';
      return '';
    }
  };
  const sandbox = buildSandbox(sheet, folder, props);
  const header = buildQueueHeader(sandbox);
  const receiptSheet = sheet.insertSheet('OCR_RECEIPT');
  receiptSheet.appendRow(header);
  receiptSheet.appendRow(buildRow(header, {
    status: 'DONE',
    file_id: 'r1',
    file_name: 'r1.jpg',
    mime_type: 'image/jpeg',
    drive_url: 'https://example.com/r1',
    queued_at_iso: '2025-01-01T00:00:00Z',
    doc_type: 'receipt',
    source_subfolder: 'receipt',
    ocr_json: JSON.stringify({
      receipt_total_jpy: 1000,
      merchant: 'SHOP R',
      transaction_date: '2025-04-01'
    })
  }));

  const exportLog = sheet.insertSheet('EXPORT_LOG');
  exportLog.appendRow(['csv_file_id', 'file_id', 'exported_at_iso', 'extra_col']);

  const res1 = sandbox.belle_exportYayoiCsvFallback({});
  expect(res1 && res1.ok === true, 'export should succeed with extra columns');
  expect(countFiles(folder) === 1, 'CSV should be created');

  const fileIdIdx = exportLog.data[0].indexOf('file_id');
  expect(fileIdIdx >= 0, 'file_id column should exist');
  expect(exportLog.data.length === 2, 'EXPORT_LOG should have header + 1 row');
  expect(exportLog.data[1][fileIdIdx] === 'r1', 'file_id should be written to correct column');

  const res2 = sandbox.belle_exportYayoiCsvFallback({});
  expect(res2 && res2.ok === true, 'second export should not error');
  expect(countFiles(folder) === 1, 'dedupe should prevent second CSV');
  expect(exportLog.data.length === 2, 'EXPORT_LOG should not grow on dedupe');
}

console.log('OK: test_export_log_schema_guard');




