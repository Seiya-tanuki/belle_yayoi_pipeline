const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
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
  setValue(value) {
    if (!this.sheet.data[this.row - 1]) this.sheet.data[this.row - 1] = [];
    this.sheet.data[this.row - 1][this.col - 1] = value;
    return this;
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
expect(sh.data[1][11] === 1, 'seen_count should start at 1');

appendQueue(ss, [detail], '2025-01-02T00:00:00Z', props);
expect(sh.data.length === 2, 'duplicate should not append');
expect(sh.data[1][10] === '2025-01-02T00:00:00Z', 'last_seen_at_iso should update');
expect(sh.data[1][11] === 2, 'seen_count should increment');

appendQueue(ss, [{ ...detail, reason: 'PDF_PAGECOUNT_UNKNOWN' }], '2025-01-01T00:00:00Z', props);
expect(sh.data.length === 3, 'different reason should append');
expect(sh.data[2][11] === 1, 'new reason should start seen_count at 1');

console.log('OK: test_queue_skip_log_dedupe');
