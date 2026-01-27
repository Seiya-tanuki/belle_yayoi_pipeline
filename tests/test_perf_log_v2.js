const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/OcrCommon.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const getHeader = sandbox.belle_perf_getHeaderV2_;
const buildRow = sandbox.belle_perf_buildRowV2_;
expect(typeof getHeader === 'function', 'missing belle_perf_getHeaderV2_');
expect(typeof buildRow === 'function', 'missing belle_perf_buildRowV2_');

const header = getHeader();
expect(Array.isArray(header), 'header should be array');
expect(header.length === 13, 'header length should be 13');
expect(header[0] === 'logged_at_iso', 'header[0] mismatch');
expect(header[12] === 'detail_json', 'header[12] mismatch');

const evt = {
  phase: 'TEST_PHASE',
  ok: true,
  docType: 'cc_statement',
  queueSheetName: 'OCR_CC',
  lastReason: 'OCR_PENDING',
  lockBusySkipped: 1,
  httpStatus: 503,
  ccErrorCode: 'CC_STAGE1',
  ccStage: 'stage1',
  ccCacheHit: true,
  processingCount: 2
};
const row = buildRow(evt);
expect(Array.isArray(row), 'row should be array');
expect(row.length === header.length, 'row length mismatch');
expect(String(row[0]).indexOf('T') > 0, 'logged_at_iso should be ISO-like');
expect(row[1] === 'TEST_PHASE', 'phase mismatch');
expect(row[2] === 'true', 'ok should be true');
expect(row[3] === 'cc_statement', 'doc_type mismatch');
expect(row[4] === 'OCR_CC', 'queue_sheet_name mismatch');
expect(row[7] === 503, 'http_status mismatch');
expect(row[9] === 'stage1', 'cc_stage mismatch');
expect(row[10] === 'true', 'cc_cache_hit mismatch');
expect(row[11] === 2, 'processing_count mismatch');
expect(String(row[12]).indexOf('"phase":"TEST_PHASE"') >= 0, 'detail_json should include event');

console.log('OK: test_perf_log_v2');
