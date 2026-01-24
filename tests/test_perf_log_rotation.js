const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/OcrWorkerParallel_v0.js', 'utf8');
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

const ensure = sandbox.belle_log_ensureSheetWithHeader_;
const getHeader = sandbox.belle_perf_getHeaderV2_;
expect(typeof ensure === 'function', 'missing belle_log_ensureSheetWithHeader_');
expect(typeof getHeader === 'function', 'missing belle_perf_getHeaderV2_');

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

const ss = new MockSpreadsheet();
const header = getHeader();

const first = ensure(ss, 'PERF_LOG', header);
expect(first.sheet, 'first ensure should return sheet');
expect(Object.keys(ss.sheets).length === 1, 'should have 1 sheet after first ensure');
expect(ss.getSheetByName('PERF_LOG'), 'PERF_LOG should exist');

const second = ensure(ss, 'PERF_LOG', header);
expect(second.sheet, 'second ensure should return sheet');
expect(Object.keys(ss.sheets).length === 1, 'should not rotate with matching header');
const legacy = Object.keys(ss.sheets).find((name) => name.indexOf('__legacy__') >= 0);
expect(!legacy, 'no legacy sheet should be created');

console.log('OK: test_perf_log_rotation');
