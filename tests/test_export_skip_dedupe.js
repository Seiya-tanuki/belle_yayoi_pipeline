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
  setName(name) {
    this.name = name;
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

function countFiles(folder) {
  let count = folder.files.length;
  const names = Object.keys(folder.subfolders || {});
  for (let i = 0; i < names.length; i++) {
    const list = folder.subfolders[names[i]] || [];
    for (let j = 0; j < list.length; j++) {
      count += countFiles(list[j]);
    }
  }
  return count;
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

const logs = [];
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

const code = fs.readFileSync('gas/Config.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8')
  + '\n' + fs.readFileSync('gas/YayoiExport.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrValidation.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Export.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Review.js', 'utf8');

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

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

const ccSheet = mockSpreadsheet.insertSheet('OCR_CC');
ccSheet.appendRow(header);
ccSheet.appendRow(buildRow({
  status: 'ERROR_FINAL',
  file_id: 'cc_err',
  file_name: 'cc_err.pdf',
  mime_type: 'application/pdf',
  drive_url: 'https://example.com/cc_err',
  queued_at_iso: '2025-01-01T00:00:00Z',
  doc_type: 'cc_statement',
  source_subfolder: 'cc_statement',
  ocr_error_code: 'CC_NON_TRANSACTION_PAGE',
  ocr_error_detail: '{"task":"page_classification","page_type":"non_transactions"}'
}));
ccSheet.appendRow(buildRow({
  status: 'DONE',
  file_id: 'cc_ok',
  file_name: 'cc_ok.pdf',
  mime_type: 'application/pdf',
  drive_url: 'https://example.com/cc_ok',
  queued_at_iso: '2025-01-01T00:00:00Z',
  doc_type: 'cc_statement',
  source_subfolder: 'cc_statement',
  ocr_json: JSON.stringify({
    task: 'transaction_extraction',
    transactions: [
      {
        row_no: 1,
        raw_use_date_text: '4/1',
        use_month: 4,
        use_day: 1,
        merchant: 'SHOP C',
        amount_yen: 1200,
        amount_sign: 'debit',
        issues: []
      },
      {
        row_no: 2,
        raw_use_date_text: '4/2',
        use_month: 4,
        use_day: 2,
        merchant: 'SHOP D',
        amount_yen: 300,
        amount_sign: 'credit',
        issues: []
      }
    ]
  })
}));

const res1 = sandbox.belle_exportYayoiCsvCcStatement({});
expect(res1 && res1.ok === true, 'first export should succeed');
expect(countFiles(rootFolder) === 1, 'first export should create one csv file');

const skipSheet = mockSpreadsheet.getSheetByName('EXPORT_SKIP_LOG');
expect(skipSheet, 'EXPORT_SKIP_LOG should exist');
expect(skipSheet.data.length === 3, 'skip log should have header + 2 rows');

const res2 = sandbox.belle_exportYayoiCsvCcStatement({});
expect(res2 && res2.ok === true, 'second export should return ok');
expect(countFiles(rootFolder) === 1, 'second export should not create new csv file');
expect(skipSheet.data.length === 3, 'skip log should not append duplicates');

console.log('OK: test_export_skip_dedupe');





