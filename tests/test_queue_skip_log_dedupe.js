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
expectTrue(typeof appendQueue === 'function', 'missing belle_appendQueueSkipLogRows_');

const ss = new MockSpreadsheet();
const props = { getProperty: () => '' };

const detail = {
  file_id: 'f1',
  file_name: 'multi.pdf',
  drive_url: 'https://drive.google.com/file/d/f1/view',
  doc_type: 'receipt',
  source_subfolder: 'receipt',
  reason: 'MULTI_PAGE_PDF',
  detail: 'method=byte_scan:/Type /Page detected_page_count=2'
};

appendQueue(ss, [detail], '2025-01-01T00:00:00Z', props);
const sh = ss.getSheetByName('QUEUE_SKIP_LOG');
expectTrue(sh, 'QUEUE_SKIP_LOG should be created');
expectEqual(sh.data.length, 2, 'should write header + 1 row');
expectEqual(sh.data[1][11], 1, 'seen_count should start at 1');

appendQueue(ss, [detail], '2025-01-02T00:00:00Z', props);
expectEqual(sh.data.length, 2, 'duplicate should not append');
expectEqual(sh.data[1][10], '2025-01-02T00:00:00Z', 'last_seen_at_iso should update');
expectEqual(sh.data[1][11], 2, 'seen_count should increment');

appendQueue(ss, [{ ...detail, reason: 'PDF_PAGECOUNT_UNKNOWN' }], '2025-01-01T00:00:00Z', props);
expectEqual(sh.data.length, 3, 'different reason should append');
expectEqual(sh.data[2][11], 1, 'new reason should start seen_count at 1');

console.log('OK: test_queue_skip_log_dedupe');
