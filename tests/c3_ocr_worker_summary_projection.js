const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const code = fs.readFileSync('gas/OcrWorkerParallel.js', 'utf8');
const logs = [];
const sandbox = {
  console,
  Logger: { log: (x) => logs.push(x) },
  BELLE_DOC_PIPELINE_TWO_STAGE: 'two_stage',
  BELLE_DOC_PIPELINE_INACTIVE: 'inactive',
  Utilities: { getUuid: () => 'AUTO-WORKER' }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

sandbox.belle_cfg_getProps_ = () => ({
  getProperty: (key) => {
    if (key === 'BELLE_OCR_WORKER_MAX_ITEMS') return '5';
    return '';
  }
});
sandbox.belle_ocr_worker_resolveMaxItems_ = (v) => Number(v || 0) || 1;
sandbox.belle_ocr_getActiveDocTypes_ = () => ['cc_statement', 'receipt'];
sandbox.belle_docType_getSpec_ = (docType) => {
  if (docType === 'cc_statement') return { pipeline_kind: 'two_stage' };
  if (docType === 'inactive_doc') return { pipeline_kind: 'inactive' };
  return { pipeline_kind: 'single_stage' };
};
sandbox.belle_ocr_shouldStopAfterItem_ = () => false;

const sequence = [
  {
    processed: 1,
    outcome: 'DONE',
    rowIndex: 9,
    file_id: 'F-1',
    statusBefore: 'OCR_PENDING',
    claimElapsedMs: 11,
    geminiElapsedMs: 10,
    totalItemElapsedMs: 20,
    classify: 'DONE',
    httpStatus: 200,
    docType: 'cc_statement',
    queueSheetName: 'OCR_CC',
    ccStage: 'stage2',
    ccCacheHit: false,
    ccGeminiMs: 12,
    ccHttpStatus: 200,
    ccErrorCode: '',
    processingCount: 3
  },
  {
    processed: 1,
    outcome: 'ERROR_RETRYABLE',
    rowIndex: 10,
    file_id: 'F-2',
    statusBefore: 'ERROR_RETRYABLE',
    claimElapsedMs: 12,
    geminiElapsedMs: 30,
    totalItemElapsedMs: 40,
    classify: 'ERROR_RETRYABLE',
    httpStatus: 503,
    docType: 'cc_statement',
    queueSheetName: 'OCR_CC',
    ccStage: 'stage1',
    ccCacheHit: true,
    ccGeminiMs: 44,
    ccHttpStatus: 503,
    ccErrorCode: 'HTTP_503',
    processingCount: 4
  },
  {
    processed: 1,
    outcome: 'ERROR_FINAL',
    rowIndex: 11,
    file_id: 'F-3',
    statusBefore: 'ERROR',
    claimElapsedMs: 13,
    geminiElapsedMs: 50,
    totalItemElapsedMs: 60,
    classify: 'ERROR_FINAL',
    httpStatus: 400,
    docType: 'receipt',
    queueSheetName: 'OCR_RECEIPT',
    processingCount: 7
  },
  { processed: 0, reason: 'NO_TARGET' }
];
let idx = 0;
sandbox.belle_ocr_workerOnce_ = () => sequence[idx++] || { processed: 0, reason: 'NO_TARGET' };

const summary = sandbox.belle_ocr_workerLoop_({
  workerId: 'W-SUM',
  maxItems: 5,
  docTypes: ['cc_statement', 'receipt']
});

expect(summary.ok === true, 'summary.ok');
expect(summary.processed === 3, 'summary.processed');
expect(summary.done === 1, 'summary.done');
expect(summary.errors === 2, 'summary.errors');
expect(summary.retryable === 1, 'summary.retryable');
expect(summary.final === 1, 'summary.final');
expect(summary.lastReason === 'NO_TARGET', 'summary.lastReason');
expect(summary.lockBusySkipped === 0, 'summary.lockBusySkipped');

expect(summary.claimedRowIndex === 9, 'summary.claimedRowIndex');
expect(summary.claimedFileId === 'F-1', 'summary.claimedFileId');
expect(summary.claimedStatusBefore === 'OCR_PENDING', 'summary.claimedStatusBefore');
expect(summary.claimedDocType === 'cc_statement', 'summary.claimedDocType');
expect(summary.claimElapsedMs === 11, 'summary.claimElapsedMs');

expect(summary.docType === 'cc_statement', 'summary.docType');
expect(summary.queueSheetName === 'OCR_CC', 'summary.queueSheetName');
expect(summary.classify === 'ERROR_FINAL', 'summary.classify');
expect(summary.httpStatus === 400, 'summary.httpStatus');
expect(summary.processingCount === 7, 'summary.processingCount');

expect(summary.avgGeminiMs === 30, 'summary.avgGeminiMs');
expect(summary.p95GeminiMs === 30, 'summary.p95GeminiMs');
expect(summary.geminiElapsedMs === 30, 'summary.geminiElapsedMs');
expect(summary.avgTotalItemMs === 40, 'summary.avgTotalItemMs');
expect(summary.p95TotalItemMs === 40, 'summary.p95TotalItemMs');
expect(summary.totalItemElapsedMs === 40, 'summary.totalItemElapsedMs');

expect(summary.ccStage === 'stage1', 'summary.ccStage');
expect(summary.ccCacheHit === true, 'summary.ccCacheHit');
expect(summary.ccGeminiMs === 44, 'summary.ccGeminiMs');
expect(summary.ccHttpStatus === 503, 'summary.ccHttpStatus');
expect(summary.ccErrorCode === 'HTTP_503', 'summary.ccErrorCode');

expect(logs.length > 0, 'Logger.log should be called');
expect(logs[logs.length - 1].phase === 'OCR_WORKER_SUMMARY', 'last log should be summary');

console.log('OK: c3_ocr_worker_summary_projection');
