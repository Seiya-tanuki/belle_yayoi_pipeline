const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const appendRows = sandbox.belle_sheet_appendRowsInChunks_;
expect(typeof appendRows === 'function', 'missing belle_sheet_appendRowsInChunks_');

const calls = [];
const sheet = {
  lastRow: 3,
  getLastRow() {
    return this.lastRow;
  },
  getRange(row, col, numRows, numCols) {
    return {
      setValues: (vals) => {
        calls.push({ row, numRows, numCols, vals });
        this.lastRow = row + numRows - 1;
      }
    };
  }
};

const rows = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10]
];

const written = appendRows(sheet, rows, 2);
expect(written === 5, 'written rows should be 5');
expect(calls.length === 3, 'should call setValues 3 times');
expect(calls[0].row === 4 && calls[0].numRows === 2 && calls[0].numCols === 2, 'first chunk position mismatch');
expect(calls[1].row === 6 && calls[1].numRows === 2 && calls[1].numCols === 2, 'second chunk position mismatch');
expect(calls[2].row === 8 && calls[2].numRows === 1 && calls[2].numCols === 2, 'third chunk position mismatch');

console.log('OK: test_sheet_append_rows');





