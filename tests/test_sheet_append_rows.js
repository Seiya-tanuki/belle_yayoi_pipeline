const { loadFilesInOrder } = require('./helpers/module_loader');
const { MockSheet } = require('./helpers/mock_sheet');
const { expectTrue, expectEqual } = require('./helpers/assertions');

const sandbox = loadFilesInOrder([
  'gas/Config.js',
  'gas/DocTypeRegistry.js',
  'gas/Log.js',
  'gas/Sheet.js',
  'gas/Drive.js',
  'gas/Pdf.js',
  'gas/Gemini.js',
  'gas/Code.js',
  'gas/Queue.js'
]);

const appendRows = sandbox.belle_sheet_appendRowsInChunks_;
expectTrue(typeof appendRows === 'function', 'missing belle_sheet_appendRowsInChunks_');

const calls = [];
const sheet = new MockSheet('APPEND_TARGET');
sheet.data = [[0, 0], [0, 0], [0, 0]];
const baseGetRange = sheet.getRange.bind(sheet);
sheet.getRange = (row, col, numRows, numCols) => {
  const range = baseGetRange(row, col, numRows, numCols);
  const baseSetValues = range.setValues.bind(range);
  range.setValues = (vals) => {
    calls.push({ row, numRows, numCols, vals });
    return baseSetValues(vals);
  };
  return range;
};

const rows = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10]
];

const written = appendRows(sheet, rows, 2);
expectEqual(written, 5, 'written rows should be 5');
expectEqual(calls.length, 3, 'should call setValues 3 times');
expectTrue(calls[0].row === 4 && calls[0].numRows === 2 && calls[0].numCols === 2, 'first chunk position mismatch');
expectTrue(calls[1].row === 6 && calls[1].numRows === 2 && calls[1].numCols === 2, 'second chunk position mismatch');
expectTrue(calls[2].row === 8 && calls[2].numRows === 1 && calls[2].numCols === 2, 'third chunk position mismatch');
expectEqual(sheet.getLastRow(), 8, 'last row should be updated');

console.log('OK: test_sheet_append_rows');
