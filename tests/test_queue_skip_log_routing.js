const { loadFilesInOrder } = require('./helpers/module_loader');
const { MockSpreadsheet } = require('./helpers/mock_sheet');
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

const appendQueue = sandbox.belle_appendQueueSkipLogRows_;
const appendSkip = sandbox.belle_appendSkipLogRows;
expectTrue(typeof appendQueue === 'function', 'missing belle_appendQueueSkipLogRows_');
expectTrue(typeof appendSkip === 'function', 'missing belle_appendSkipLogRows');

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
expectTrue(queueSheet, 'queue skip log sheet missing');
expectTrue(!exportSheet, 'export skip log should not be created by queue skip');
expectEqual(queueSheet.data.length, 2, 'queue skip should write header + 1 row');
expectEqual(queueSheet.data[1][1], 'QUEUE_SKIP', 'phase should be QUEUE_SKIP');

appendSkip(ss, 'EXPORT_SKIP_LOG', details, '2025-01-01T00:00:00Z', 'EXPORT_SKIP');
const exportSheetAfter = ss.getSheetByName('EXPORT_SKIP_LOG');
expectTrue(exportSheetAfter, 'export skip log sheet missing after export skip');
expectEqual(queueSheet.data.length, 2, 'queue skip log should remain unchanged by export skip');

console.log('OK: test_queue_skip_log_routing');
