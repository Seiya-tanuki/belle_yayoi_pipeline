const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

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
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
    this.throwOnDataRange = false;
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
    if (this.throwOnDataRange && row === 2) {
      throw new Error('range boom');
    }
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
    const sh = new MockSheet(name);
    this.sheets[name] = sh;
    return sh;
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
    const f = new MockFolder(name);
    if (!this.subfolders[name]) this.subfolders[name] = [];
    this.subfolders[name].push(f);
    return f;
  }
  createFile(blob) {
    const id = 'file_' + String(this.files.length + 1);
    const file = { getId: () => id, blob };
    this.files.push(file);
    return file;
  }
}

function buildSandbox(propsMap, options) {
  const spreadsheet = new MockSpreadsheet();
  const rootFolder = new MockFolder('root');
  const logs = [];
  const opts = options || {};
  const code =
    fs.readFileSync('gas/Config.js', 'utf8') + '\n' +
    fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Log.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Drive.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Code.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Queue.js', 'utf8') + '\n' +
    fs.readFileSync('gas/Export.js', 'utf8') + '\n' +
    fs.readFileSync('gas/YayoiExport.js', 'utf8') + '\n' +
    fs.readFileSync('gas/OcrValidation.js', 'utf8');

  const sandbox = {
    console,
    Logger: { log: (v) => logs.push(v) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => propsMap[key] || ''
      })
    },
    SpreadsheetApp: {
      openById: () => spreadsheet
    },
    DriveApp: {
      getFolderById: () => {
        if (opts.throwFolder) throw new Error('folder boom');
        return rootFolder;
      }
    },
    Utilities: {
      formatDate: () => '20260206_000000',
      newBlob: (input) => ({
        getBytes: () => Buffer.from(String(input || ''), 'utf8'),
        setDataFromString: () => {}
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { sandbox, spreadsheet, logs };
}

function buildBaseProps() {
  return {
    BELLE_SHEET_ID: 'sheet1',
    BELLE_OUTPUT_FOLDER_ID: 'out1',
    BELLE_FISCAL_START_DATE: '2025-01-01',
    BELLE_FISCAL_END_DATE: '2025-12-31',
    BELLE_CSV_ENCODING: 'UTF8',
    BELLE_CSV_EOL: 'LF'
  };
}

function buildRow(header, values) {
  const row = new Array(header.length).fill('');
  const keys = Object.keys(values);
  for (let i = 0; i < keys.length; i++) {
    const idx = header.indexOf(keys[i]);
    if (idx >= 0) row[idx] = values[keys[i]];
  }
  return row;
}

function expectHasPhase(logs, phase) {
  const found = logs.some((v) => v && typeof v === 'object' && v.phase === phase);
  expect(found, 'missing phase log: ' + phase);
}

function runGuardScenario() {
  const props = buildBaseProps();
  props.BELLE_FISCAL_START_DATE = 'invalid';
  const ctx = buildSandbox(props);
  const res = ctx.sandbox.belle_exportYayoiCsvReceiptInternal_({});
  expect(res && res.phase === 'EXPORT_GUARD', 'guard scenario should return EXPORT_GUARD');
  expectHasPhase(ctx.logs, 'EXPORT_GUARD');
}

function runDoneScenario() {
  const props = buildBaseProps();
  const ctx = buildSandbox(props);
  const header = ctx.sandbox.belle_getQueueHeaderColumns().concat(ctx.sandbox.belle_getQueueLockHeaderColumns_());
  const queue = ctx.spreadsheet.insertSheet('OCR_RECEIPT');
  queue.appendRow(header);
  queue.appendRow(buildRow(header, {
    status: 'DONE',
    file_id: 'receipt_done_1',
    file_name: 'r1.jpg',
    mime_type: 'image/jpeg',
    drive_url: 'https://example.invalid/r1',
    queued_at_iso: '2025-01-01T00:00:00Z',
    doc_type: 'receipt',
    source_subfolder: 'receipt',
    ocr_json: '{"dummy":true}'
  }));

  const exportLog = ctx.spreadsheet.insertSheet('EXPORT_LOG');
  const exportHeader = ctx.sandbox.belle_getExportLogHeaderColumns();
  exportLog.appendRow(exportHeader);
  exportLog.appendRow(['receipt_done_1', '2025-01-01T00:00:00Z', 'csv_existing']);

  const res = ctx.sandbox.belle_exportYayoiCsvReceiptInternal_({});
  expect(res && res.phase === 'EXPORT_DONE', 'done scenario should return EXPORT_DONE');
  expect(res.reason === 'NO_EXPORT_ROWS', 'done scenario should return NO_EXPORT_ROWS');
  expectHasPhase(ctx.logs, 'EXPORT_DONE');
}

function runErrorScenario() {
  const props = buildBaseProps();
  const ctx = buildSandbox(props);
  const header = ctx.sandbox.belle_getQueueHeaderColumns().concat(ctx.sandbox.belle_getQueueLockHeaderColumns_());
  const queue = ctx.spreadsheet.insertSheet('OCR_RECEIPT');
  queue.appendRow(header);
  queue.appendRow(buildRow(header, {
    status: 'DONE',
    file_id: 'receipt_error_1',
    file_name: 'r2.jpg',
    mime_type: 'image/jpeg',
    drive_url: 'https://example.invalid/r2',
    queued_at_iso: '2025-01-01T00:00:00Z',
    doc_type: 'receipt',
    source_subfolder: 'receipt',
    ocr_json: '{"dummy":true}'
  }));
  queue.throwOnDataRange = true;

  let threw = false;
  try {
    ctx.sandbox.belle_exportYayoiCsvReceiptInternal_({});
  } catch (_e) {
    threw = true;
  }
  expect(threw, 'error scenario should throw');
  expectHasPhase(ctx.logs, 'EXPORT_ERROR');
}

runGuardScenario();
runDoneScenario();
runErrorScenario();

console.log('OK: c1_export_signal_continuity');
