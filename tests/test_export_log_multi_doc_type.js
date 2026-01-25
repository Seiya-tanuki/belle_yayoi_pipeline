const fs = require('fs');
const vm = require('vm');

const logs = [];
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
    const id = 'file_' + (++fileCounter);
    const file = { getId: () => id, blob };
    this.files.push(file);
    return file;
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const props = {
  BELLE_SHEET_ID: 'sheet1',
  BELLE_OUTPUT_FOLDER_ID: 'out1',
  BELLE_FISCAL_START_DATE: '2025-01-01',
  BELLE_FISCAL_END_DATE: '2025-12-31',
  BELLE_CSV_ENCODING: 'UTF8',
  BELLE_CSV_EOL: 'LF'
};

const mockSpreadsheet = new MockSpreadsheet();
const rootFolder = new MockFolder('root');

const sandbox = {
  console,
  Logger: { log: (msg) => logs.push(msg) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => props[key] || ''
    })
  },
  SpreadsheetApp: {
    openById: () => mockSpreadsheet
  },
  DriveApp: {
    getFolderById: () => rootFolder
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
vm.runInContext(fs.readFileSync('gas/Config_v0.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/YayoiExport_v0.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/OcrValidation_v0.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/Review_v0.js', 'utf8'), sandbox);

const baseHeader = sandbox.belle_getQueueHeaderColumns_v0();
const lockHeader = sandbox.belle_getQueueLockHeaderColumns_v0_();
const header = baseHeader.concat(lockHeader);

function buildRow(values) {
  const row = new Array(header.length).fill('');
  for (const key of Object.keys(values)) {
    const idx = header.indexOf(key);
    if (idx >= 0) row[idx] = values[key];
  }
  return row;
}

const receiptSheet = mockSpreadsheet.insertSheet('OCR_RECEIPT');
receiptSheet.appendRow(header);
receiptSheet.appendRow(buildRow({
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

const ccSheet = mockSpreadsheet.insertSheet('OCR_CC');
ccSheet.appendRow(header);
ccSheet.appendRow(buildRow({
  status: 'DONE',
  file_id: 'cc1',
  file_name: 'cc1.pdf',
  mime_type: 'application/pdf',
  drive_url: 'https://example.com/cc1',
  queued_at_iso: '2025-01-01T00:00:00Z',
  doc_type: 'cc_statement',
  source_subfolder: 'cc_statement',
  ocr_json: JSON.stringify({
    task: 'transaction_extraction',
    transactions: [
      {
        row_no: 1,
        raw_use_date_text: '4?1?',
        use_month: 4,
        use_day: 1,
        merchant: 'SHOP C',
        amount_yen: 1200,
        amount_sign: 'debit',
        issues: []
      }
    ]
  })
}));

const res = sandbox.belle_exportYayoiCsvFallback({});
expect(res && res.ok === true, 'export should succeed');

const exportLog = mockSpreadsheet.getSheetByName('EXPORT_LOG');
expect(exportLog, 'EXPORT_LOG should exist');
const logRows = exportLog.getLastRow();
expect(logRows === 3, 'EXPORT_LOG should have 2 rows plus header');
const vals = exportLog.getRange(2, 1, logRows - 1, 1).getValues().map((v) => String(v[0] || '')).sort();
expect(vals.length === 2, 'EXPORT_LOG should contain 2 entries');
expect(vals[0] === 'cc1' && vals[1] === 'r1', 'EXPORT_LOG should include cc1 and r1');

console.log('OK: test_export_log_multi_doc_type');







