const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrValidation.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrCommon.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrCcPipeline.js', 'utf8');

const sandbox = {
  console,
  Logger: { log: () => {} },
  DriveApp: {
    getFileById: () => ({ getBlob: () => ({}) })
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

sandbox.belle_ocr_computeGeminiTemperature_ = () => ({
  temperature: 0,
  defaultTemp: 0,
  addTemp: 0,
  overridden: false
});
sandbox.belle_ocr_getCcStage1Prompt_ = () => 'STAGE1_PROMPT';
sandbox.belle_ocr_getCcStage2Prompt_ = () => 'STAGE2_PROMPT';

const props = { getProperty: () => '' };

function runWithResponses(responses, ctxOverrides) {
  let idx = 0;
  sandbox.belle_callGeminiOcr = () => {
    const res = responses[idx];
    idx += 1;
    return res;
  };
  const ctx = Object.assign({
    props: props,
    fileId: 'file-id',
    attempt: 1,
    maxAttempts: 3,
    statusBefore: 'QUEUED',
    prevErrorCode: '',
    prevError: '',
    prevErrorDetail: '',
    ocrJsonBefore: '',
    backoffSeconds: 300
  }, ctxOverrides || {});
  return sandbox.belle_ocr_cc_runOnce_(ctx);
}

const stage1Transactions = JSON.stringify({
  task: 'page_classification',
  page_type: 'transactions',
  reason_codes: [],
  page_issues: []
});
const stage1Non = JSON.stringify({
  task: 'page_classification',
  page_type: 'non_transactions',
  reason_codes: [],
  page_issues: []
});
const stage1Unknown = JSON.stringify({
  task: 'page_classification',
  page_type: 'unknown',
  reason_codes: [],
  page_issues: []
});
const stage2Ok = JSON.stringify({
  task: 'transaction_extraction',
  transactions: [
    {
      row_no: 1,
      raw_use_date_text: '6?21?',
      use_month: 6,
      use_day: 21,
      merchant: 'SHOP A',
      amount_yen: 1200,
      amount_sign: 'debit',
      issues: []
    }
  ]
});
const stage2Empty = JSON.stringify({
  task: 'transaction_extraction',
  transactions: []
});

const stage1Tx = runWithResponses([stage1Transactions]);
expect(stage1Tx.statusOut === 'QUEUED', 'stage1 transactions should queue');
expect(stage1Tx.jsonStr === stage1Transactions, 'stage1 transactions should cache json');
expect(stage1Tx.outcome === 'STAGE1_CACHED', 'stage1 transactions outcome mismatch');

const stage1NonRes = runWithResponses([stage1Non]);
expect(stage1NonRes.statusOut === 'ERROR_FINAL', 'stage1 non_transactions should be ERROR_FINAL');
expect(stage1NonRes.errorCode === 'CC_NON_TRANSACTION_PAGE', 'stage1 non_transactions errorCode mismatch');

const stage1UnknownRes = runWithResponses([stage1Unknown]);
expect(stage1UnknownRes.statusOut === 'ERROR_RETRYABLE', 'stage1 unknown should be ERROR_RETRYABLE');
expect(stage1UnknownRes.errorCode === 'CC_PAGE_UNKNOWN', 'stage1 unknown errorCode mismatch');

const stage2OkRes = runWithResponses([stage2Ok], { ocrJsonBefore: stage1Transactions });
expect(stage2OkRes.statusOut === 'DONE', 'stage2 success should be DONE');
expect(stage2OkRes.jsonStr === stage2Ok, 'stage2 success should overwrite json');
expect(stage2OkRes.ccStage === 'stage2', 'stage2 should set ccStage=stage2');
expect(stage2OkRes.ccCacheHit === true, 'stage2 should set ccCacheHit');

const stage2EmptyRes = runWithResponses([stage2Empty], { ocrJsonBefore: stage1Transactions });
expect(stage2EmptyRes.statusOut === 'ERROR_RETRYABLE', 'stage2 empty should be ERROR_RETRYABLE');
expect(stage2EmptyRes.errorCode === 'CC_NO_ROWS_EXTRACTED', 'stage2 empty errorCode mismatch');
expect(stage2EmptyRes.keepOcrJsonOnError === true, 'stage2 empty should preserve cache');
expect(stage2EmptyRes.nextRetryIso && stage2EmptyRes.nextRetryIso.indexOf('T') > 0, 'stage2 empty should set nextRetryIso');

require('./test_ocr_cc_temperature_precedence');
require('./test_ocr_cc_gencfg_override_new_key');

console.log('OK: test_ocr_cc_pipeline_parity');
