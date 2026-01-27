const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8') + '\n' + fs.readFileSync('gas/ChatworkWebhook.js', 'utf8');
const sandbox = {
  console,
  Utilities: {
    formatDate: () => '20250101_000000'
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

class MockSheet {
  constructor(name, ss) {
    this.name = name;
    this.ss = ss;
    this.data = [];
  }
  getRange(row, col, numRows, numCols) {
    return {
      getValues: () => {
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const rowIdx = row - 1 + r;
          const rowVals = this.data[rowIdx] || [];
          const vals = [];
          for (let c = 0; c < numCols; c++) {
            const colIdx = col - 1 + c;
            vals.push(rowVals[colIdx] !== undefined ? rowVals[colIdx] : '');
          }
          out.push(vals);
        }
        return out;
      },
      setValues: (values) => {
        for (let r = 0; r < values.length; r++) {
          const rowIdx = row - 1 + r;
          if (!this.data[rowIdx]) this.data[rowIdx] = [];
          for (let c = 0; c < values[r].length; c++) {
            const colIdx = col - 1 + c;
            this.data[rowIdx][colIdx] = values[r][c];
          }
        }
      }
    };
  }
  setName(name) {
    delete this.ss.sheets[this.name];
    this.name = name;
    this.ss.sheets[name] = this;
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
    const sh = new MockSheet(name, this);
    this.sheets[name] = sh;
    return sh;
  }
}

const ensureWebhook = sandbox.belle_chatwork_webhook_ensureLogSheet_;
expect(typeof ensureWebhook === 'function', 'missing belle_chatwork_webhook_ensureLogSheet_');

const ss = new MockSpreadsheet();
const sh = ss.insertSheet('WEBHOOK_LOG');
sh.data[0] = ['bad', 'phase', 'detail'];

const first = ensureWebhook(ss);
expect(first, 'ensure should return sheet');
expect(ss.getSheetByName('WEBHOOK_LOG'), 'WEBHOOK_LOG should exist');

const legacy = Object.keys(ss.sheets).find((name) => name.indexOf('__legacy__') >= 0);
expect(legacy, 'legacy sheet should be created on mismatch');

const header = ss.getSheetByName('WEBHOOK_LOG').getRange(1, 1, 1, 3).getValues()[0];
expect(header.join(',') === 'received_at_iso,phase,detail', 'header should match expected');

const beforeCount = Object.keys(ss.sheets).length;
ensureWebhook(ss);
const afterCount = Object.keys(ss.sheets).length;
expect(beforeCount === afterCount, 'no additional rotation when header matches');

console.log('OK: test_webhook_log_rotation');





