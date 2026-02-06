const { MockSheet, MockSpreadsheet, bytesFromString } = require('./helpers/mock_sheet');
const { expectTrue, expectEqual, expectArrayEqual } = require('./helpers/assertions');

const sheet = new MockSheet('TEST');
sheet.appendRow(['a', 'b']);
sheet.getRange(2, 1, 1, 2).setValues([[1, 2]]);

const rows = sheet.getRange(1, 1, 2, 2).getValues();
expectArrayEqual(rows[0], ['a', 'b'], 'first row mismatch');
expectArrayEqual(rows[1], [1, 2], 'second row mismatch');

const ss = new MockSpreadsheet();
const inserted = ss.insertSheet('QUEUE_SKIP_LOG');
expectTrue(ss.getSheetByName('QUEUE_SKIP_LOG') === inserted, 'sheet lookup mismatch');

const bytes = bytesFromString('AB');
expectEqual(bytes[0], 65, 'first byte mismatch');
expectEqual(bytes[1], 66, 'second byte mismatch');

console.log('OK: t1_helper_mock_sheet_range_smoke');
