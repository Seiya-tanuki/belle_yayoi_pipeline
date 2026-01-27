const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8') + '\n'
  + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Log.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Drive.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Code.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Queue.js', 'utf8');

const sandbox = {
  console,
  Logger: { log: () => {} }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

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
  getLastColumn() {
    return this.data[0] ? this.data[0].length : 0;
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

const props = {
  getProperty: (key) => {
    if (key === 'BELLE_SHEET_ID') return 'sheet-1';
    if (key === 'BELLE_ACTIVE_DOC_TYPES') return 'receipt';
    return '';
  }
};

sandbox.PropertiesService = {
  getScriptProperties: () => props
};

const ss = new MockSpreadsheet();
sandbox.SpreadsheetApp = {
  openById: () => ss
};

function bytesFromString(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  return bytes;
}

function makePdf(id, name, content) {
  return {
    getId: () => id,
    getName: () => name,
    getMimeType: () => 'application/pdf',
    getBlob: () => ({ getBytes: () => bytesFromString(content) })
  };
}

const pdfMulti = makePdf('f1', 'multi.pdf', '/Type /Page /Type /Page');
const skipDetail = sandbox.belle_queue_checkPdfPageCount_(pdfMulti, 'receipt', 'receipt');
expect(skipDetail && skipDetail.reason === 'MULTI_PAGE_PDF', 'expected MULTI_PAGE_PDF skip');

const imgEntry = {
  id: 'f2',
  name: 'img.png',
  mimeType: 'image/png',
  url: 'https://drive.google.com/file/d/f2/view',
  source_subfolder: 'receipt'
};

sandbox.belle_listFilesInFolder = () => ({
  files: [imgEntry],
  filesByDocType: { receipt: [imgEntry] },
  skipped: [skipDetail]
});

const res = sandbox.belle_queueFolderFilesToSheet();
expect(res && res.ok === true, 'queue result should be ok');
expect(res.queued === 1, 'expected one queued row');
expect(res.skipped === 1, 'expected one skip');

const queueSheetName = sandbox.belle_ocr_getQueueSheetNameForDocType_(props, 'receipt');
const queueSheet = ss.getSheetByName(queueSheetName);
expect(queueSheet, 'queue sheet should be created');
expect(queueSheet.data.length === 2, 'queue sheet should have header + 1 row');

const skipSheet = ss.getSheetByName('QUEUE_SKIP_LOG');
expect(skipSheet, 'QUEUE_SKIP_LOG should be created');
expect(skipSheet.data.length === 2, 'QUEUE_SKIP_LOG should have header + 1 row');
expect(skipSheet.data[1][1] === 'QUEUE_SKIP', 'skip log phase should be QUEUE_SKIP');

console.log('OK: test_queue_parity_smoke');
