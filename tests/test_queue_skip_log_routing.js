const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const appendQueue = sandbox.belle_appendQueueSkipLogRows_;
const appendSkip = sandbox.belle_appendSkipLogRows;
expect(typeof appendQueue === 'function', 'missing belle_appendQueueSkipLogRows_');
expect(typeof appendSkip === 'function', 'missing belle_appendSkipLogRows');

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
const details = [{
  file_id: 'f1',
  file_name: 'root.pdf',
  drive_url: 'https://drive.google.com/file/d/f1/view',
  doc_type: '',
  source_subfolder: '',
  reason: 'ROOT_LEVEL_FILE',
  detail: ''
}];
const props = { getProperty: () => '' };

appendQueue(ss, details, '2025-01-01T00:00:00Z', props);

const queueSheet = ss.getSheetByName('QUEUE_SKIP_LOG');
const exportSheet = ss.getSheetByName('EXPORT_SKIP_LOG');
expect(queueSheet, 'queue skip log sheet missing');
expect(!exportSheet, 'export skip log should not be created by queue skip');
expect(queueSheet.data.length === 2, 'queue skip should write header + 1 row');
expect(queueSheet.data[1][1] === 'QUEUE_SKIP', 'phase should be QUEUE_SKIP');

appendSkip(ss, 'EXPORT_SKIP_LOG', details, '2025-01-01T00:00:00Z', 'EXPORT_SKIP');
const exportSheetAfter = ss.getSheetByName('EXPORT_SKIP_LOG');
expect(exportSheetAfter, 'export skip log sheet missing after export skip');
expect(queueSheet.data.length === 2, 'queue skip log should remain unchanged by export skip');

console.log('OK: test_queue_skip_log_routing');





