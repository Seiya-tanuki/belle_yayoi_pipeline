const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Export.js', 'utf8') + '\n' + fs.readFileSync('gas/ExportEntrypoints.js', 'utf8')
  + '\n' + fs.readFileSync('gas/EnvHealthCheck.js', 'utf8');

const calls = [];
const sandbox = {
  __props: {},
  __spreadsheet: null,
  console,
  Logger: { log: () => {} },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => sandbox.__props[key] || ''
    })
  },
  SpreadsheetApp: {
    openById: () => sandbox.__spreadsheet
  },
  CacheService: {
    getScriptCache: () => ({
      get: () => null,
      put: () => {}
    })
  },
  Utilities: {
    formatDate: () => '20250101_000000'
  },
  DriveApp: {
    getFolderById: () => ({
      getFoldersByName: (name) => {
        calls.push({ method: 'getFoldersByName', name });
        let idx = 0;
        return {
          hasNext: () => idx < 0,
          next: () => null
        };
      },
      createFolder: (name) => ({ name })
    })
  }
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

function runEnvHealthCheck(props) {
  sandbox.__props = props || {};
  sandbox.__spreadsheet = new MockSpreadsheet();
  return sandbox.belle_env_healthCheck_({ ensure: true });
}

const defs = sandbox.belle_getDocTypeDefs_();
expect(defs.length >= 2, 'doc type defs should be present');
expect(defs[0].docType === 'receipt', 'first doc type should be receipt');

const receiptDef = sandbox.belle_ocr_getDocTypeDefByDocType_('receipt');
expect(receiptDef && receiptDef.sheetName === 'OCR_RECEIPT', 'receipt def sheet mismatch');
const ccDef = sandbox.belle_ocr_getDocTypeDefByDocType_('cc_statement');
expect(ccDef && ccDef.sheetName === 'OCR_CC', 'cc def sheet mismatch');

sandbox.belle_export_resolveOutputFolderByDocType_('out', 'receipt');
sandbox.belle_export_resolveOutputFolderByDocType_('out', 'cc_statement');
expect(calls.length === 2, 'export folder lookup count mismatch');
expect(calls[0].name === 'receipt', 'receipt export subfolder mismatch');
expect(calls[1].name === 'cc_statement', 'cc export subfolder mismatch');

const handlers = sandbox.belle_export_getHandlersByRegistry_({});
const handlerKeys = Object.keys(handlers);
expect(handlerKeys[0] === 'cc_statement', 'export handler order should start with cc_statement');
expect(handlerKeys[1] === 'receipt', 'export handler order should include receipt');

const envRes = runEnvHealthCheck({
  BELLE_SHEET_ID: 'sheet1',
  BELLE_ACTIVE_DOC_TYPES: 'receipt,cc_statement,bank_statement'
});
const created = envRes && envRes.data && envRes.data.ensured ? envRes.data.ensured.sheets_created : [];
expect(created.indexOf('OCR_RECEIPT') >= 0, 'env check should create receipt queue');
expect(created.indexOf('OCR_CC') >= 0, 'env check should create cc queue');
expect(created.indexOf('OCR_BANK') >= 0, 'env check should create bank queue');

console.log('OK: test_doc_type_registry_callsite_smoke');




