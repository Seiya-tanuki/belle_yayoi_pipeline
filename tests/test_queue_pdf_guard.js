const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const checkPdf = sandbox.belle_queue_checkPdfPageCount_;
const appendQueue = sandbox.belle_appendQueueSkipLogRows_;
expect(typeof checkPdf === 'function', 'missing belle_queue_checkPdfPageCount_');
expect(typeof appendQueue === 'function', 'missing belle_appendQueueSkipLogRows_');

function bytesFromString(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  return bytes;
}

function makeFile(id, name, mimeType, content) {
  return {
    getId: () => id,
    getName: () => name,
    getMimeType: () => mimeType,
    getBlob: () => ({ getBytes: () => bytesFromString(content) })
  };
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

const multi = makeFile('f1', 'multi.pdf', 'application/pdf', '/Type /Page x /Type /Page');
const unknown = makeFile('f2', 'unknown.pdf', 'application/pdf', '/Type /Pages');
const single = makeFile('f3', 'single.pdf', 'application/pdf', '/Type /Page');

const queued = [];
const skipped = [];
const resMulti = checkPdf(multi, 'receipt', 'receipt');
const resUnknown = checkPdf(unknown, 'cc_statement', 'cc_statement');
const resSingle = checkPdf(single, 'receipt', 'receipt');

if (resMulti) skipped.push(resMulti); else queued.push(multi);
if (resUnknown) skipped.push(resUnknown); else queued.push(unknown);
if (resSingle) skipped.push(resSingle); else queued.push(single);

expect(skipped.length === 2, 'should skip 2 pdfs');
expect(queued.length === 1, 'should queue 1 pdf');
expect(resMulti && resMulti.reason === 'MULTI_PAGE_PDF', 'multi-page reason mismatch');
expect(resUnknown && resUnknown.reason === 'PDF_PAGECOUNT_UNKNOWN', 'unknown-pagecount reason mismatch');
expect(resSingle === null, 'single-page pdf should be allowed');

const ss = new MockSpreadsheet();
appendQueue(ss, skipped, '2025-01-01T00:00:00Z', { getProperty: () => '' });
const sh = ss.getSheetByName('QUEUE_SKIP_LOG');
expect(sh, 'QUEUE_SKIP_LOG should be created');
expect(sh.data.length === 3, 'QUEUE_SKIP_LOG should contain header + 2 rows');

console.log('OK: test_queue_pdf_guard');





