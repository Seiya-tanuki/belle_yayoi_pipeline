const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const appendGuard = sandbox.belle_export_appendGuardLogRow_;
const getHeader = sandbox.belle_getExportGuardLogHeader_;
expect(typeof appendGuard === 'function', 'missing belle_export_appendGuardLogRow_');
expect(typeof getHeader === 'function', 'missing belle_getExportGuardLogHeader_');

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
  }
  getLastRow() {
    return this.data.length;
  }
  getRange(row, col, numRows, numCols) {
    return new MockRange(this, row, col, numRows, numCols);
  }
  appendRow(row) {
    this.data.push(row.slice());
    return this;
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

const ss = new MockSpreadsheet();
const props = { getProperty: () => '' };
const header = getHeader();

appendGuard(ss, props, {
  doc_type: 'receipt',
  queue_sheet_name: 'OCR_RECEIPT',
  reason: 'OCR_PENDING',
  counts_json: '{"done":0}',
  detail: 'pending'
});
appendGuard(ss, props, {
  doc_type: 'cc_statement',
  queue_sheet_name: 'OCR_CC',
  reason: 'NO_ROWS',
  counts_json: '{"done":0}',
  detail: ''
});

const sheet = ss.getSheetByName('EXPORT_GUARD_LOG');
expect(sheet, 'EXPORT_GUARD_LOG should be created');
expect(sheet.data.length === 3, 'should write header + 2 rows');
expect(JSON.stringify(sheet.data[0]) === JSON.stringify(header), 'header mismatch');
expect(sheet.data[1][1] === 'EXPORT_GUARD', 'phase should be EXPORT_GUARD');
expect(sheet.data[1][2] === 'receipt', 'doc_type mismatch');
expect(sheet.data[2][2] === 'cc_statement', 'doc_type mismatch');

console.log('OK: test_export_guard_log');




