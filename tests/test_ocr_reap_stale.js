const { loadFilesInOrder } = require('./helpers/module_loader');
const { expectTrue } = require('./helpers/assertions');

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

const headerMap = {
  status: 0,
  file_id: 1,
  ocr_lock_until_iso: 2,
  ocr_lock_owner: 3,
  ocr_processing_started_at_iso: 4
};

const nowMs = Date.now();
const staleRow = [
  'PROCESSING',
  'file1',
  new Date(nowMs - 1000).toISOString(),
  'workerA',
  new Date(nowMs - 5000).toISOString()
];

const res = sandbox.belle_ocr_buildStaleRecovery_(staleRow, headerMap, nowMs);
expectTrue(res && res.statusOut === 'ERROR_RETRYABLE', 'statusOut should be ERROR_RETRYABLE');
expectTrue(res && res.errorCode === 'WORKER_STALE_LOCK', 'errorCode should be WORKER_STALE_LOCK');
expectTrue(res && res.clearLocks === true, 'clearLocks should be true');

const activeRow = [
  'PROCESSING',
  'file2',
  new Date(nowMs + 60000).toISOString(),
  'workerB',
  new Date(nowMs - 1000).toISOString()
];
const res2 = sandbox.belle_ocr_buildStaleRecovery_(activeRow, headerMap, nowMs);
expectTrue(res2 === null, 'active lock should not be reaped');

console.log('OK: test_ocr_reap_stale');
