const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrPromptBankStatement.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrValidation.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrCommon.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrBankStatementPipeline.js', 'utf8');

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

const props = { getProperty: () => '' };

function runWithResponse(response, ctxOverrides) {
  sandbox.belle_callGeminiOcr = () => response;
  const ctx = Object.assign({
    props: props,
    fileId: 'file-id',
    mimeType: 'image/png',
    docType: 'bank_statement',
    attempt: 1,
    maxAttempts: 3,
    statusBefore: 'QUEUED',
    prevErrorCode: '',
    prevError: '',
    prevErrorDetail: ''
  }, ctxOverrides || {});
  return sandbox.belle_ocr_bank_runOnce_(ctx);
}

const bankJson = JSON.stringify({
  task: 'transaction_extraction',
  transactions: [
    {
      row_no: 1,
      raw_use_date_text: null,
      use_month: null,
      use_day: null,
      merchant: null,
      amount_yen: null,
      amount_sign: 'unknown',
      issues: []
    }
  ]
});

const invalidJson = JSON.stringify({
  task: 'transaction_extraction'
});

const emptyJson = JSON.stringify({
  task: 'transaction_extraction',
  transactions: []
});

const ok = runWithResponse(bankJson);
expect(ok.statusOut === 'DONE', 'bank success should be DONE');
expect(ok.jsonStr === bankJson, 'bank success should return json');
expect(ok.errorCode === '', 'bank success errorCode should be empty');

const invalid = runWithResponse(invalidJson);
expect(invalid.statusOut === 'ERROR_RETRYABLE', 'invalid schema should be retryable');
expect(invalid.errorCode === 'INVALID_SCHEMA', 'invalid schema should set errorCode INVALID_SCHEMA');
expect(invalid.errorMessage.indexOf('INVALID_SCHEMA') >= 0, 'invalid schema should set errorMessage');
expect(invalid.errorDetail.length > 0, 'invalid schema should set errorDetail');
expect(invalid.nextRetryIso, 'invalid schema should set nextRetryIso');

const invalidMax = runWithResponse(invalidJson, { attempt: 3, maxAttempts: 3 });
expect(invalidMax.statusOut === 'ERROR_FINAL', 'invalid schema at max attempts should be ERROR_FINAL');
expect(invalidMax.errorCode === 'MAX_ATTEMPTS_EXCEEDED', 'invalid schema at max attempts should set MAX_ATTEMPTS_EXCEEDED');

const empty = runWithResponse(emptyJson);
expect(empty.statusOut === 'ERROR_RETRYABLE', 'empty transactions should be retryable');
expect(empty.errorCode === 'BANK_NO_ROWS_EXTRACTED', 'empty transactions should set BANK_NO_ROWS_EXTRACTED');
expect(empty.nextRetryIso, 'empty transactions should set nextRetryIso');

const pdfOk = runWithResponse(bankJson, { mimeType: 'application/pdf' });
expect(pdfOk.statusOut === 'DONE', 'bank pdf should be allowed');
expect(pdfOk.errorCode === '', 'bank pdf should not set errorCode');

console.log('OK: test_ocr_bank_statement_pipeline_parity');
