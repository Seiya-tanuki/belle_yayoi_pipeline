const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const appendQueue = sandbox.belle_appendQueueSkipLogRows_;
expect(typeof appendQueue === 'function', 'missing belle_appendQueueSkipLogRows_');

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

const ss = new MockSpreadsheet();
const props = { getProperty: () => '' };

const detail = {
  file_id: 'f1',
  file_name: 'multi.pdf',
  drive_url: 'https://drive.google.com/file/d/f1/view',
  doc_type: 'receipt',
  source_subfolder: 'receipt',
  reason: 'MULTI_PAGE_PDF',
  detail: 'method=byte_scan:/Type /Page detected_page_count=2'
};

appendQueue(ss, [detail], '2025-01-01T00:00:00Z', props);
const sh = ss.getSheetByName('QUEUE_SKIP_LOG');
expect(sh, 'QUEUE_SKIP_LOG should be created');
expect(sh.data.length === 2, 'should write header + 1 row');

appendQueue(ss, [detail], '2025-01-01T00:00:00Z', props);
expect(sh.data.length === 2, 'duplicate should not append');

appendQueue(ss, [{ ...detail, reason: 'PDF_PAGECOUNT_UNKNOWN' }], '2025-01-01T00:00:00Z', props);
expect(sh.data.length === 3, 'different reason should append');

console.log('OK: test_queue_skip_log_dedupe');
