const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Review_v0.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const flush = sandbox.belle_export_flushExportLog_;
expect(typeof flush === 'function', 'missing belle_export_flushExportLog_');

const calls = [];
const sheet = {
  lastRow: 1,
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

const fileIds = [];
for (let i = 0; i < 201; i++) {
  fileIds.push('fid_' + i);
}

const written = flush(sheet, fileIds, '2025-01-01T00:00:00Z', 'csv_1', 200);
expect(written === 201, 'should write all rows');
expect(calls.length === 2, 'should flush twice for 201 rows with size 200');
expect(sheet.lastRow === 202, 'last row should include header + 201 rows');

console.log('OK: test_export_log_flush');





