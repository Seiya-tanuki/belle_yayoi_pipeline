const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

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
expect(res && res.statusOut === 'ERROR_RETRYABLE', 'statusOut should be ERROR_RETRYABLE');
expect(res && res.errorCode === 'WORKER_STALE_LOCK', 'errorCode should be WORKER_STALE_LOCK');
expect(res && res.clearLocks === true, 'clearLocks should be true');

const activeRow = [
  'PROCESSING',
  'file2',
  new Date(nowMs + 60000).toISOString(),
  'workerB',
  new Date(nowMs - 1000).toISOString()
];
const res2 = sandbox.belle_ocr_buildStaleRecovery_(activeRow, headerMap, nowMs);
expect(res2 === null, 'active lock should not be reaped');

console.log('OK: test_ocr_reap_stale');



