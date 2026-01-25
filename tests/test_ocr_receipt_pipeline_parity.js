const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrValidation_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrCommon_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrReceiptPipeline_v0.js', 'utf8');

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
    docType: 'receipt',
    attempt: 1,
    maxAttempts: 3,
    statusBefore: 'QUEUED',
    prevErrorCode: '',
    prevError: '',
    prevErrorDetail: ''
  }, ctxOverrides || {});
  return sandbox.belle_ocr_receipt_runOnce_(ctx);
}

const receiptJson = JSON.stringify({
  receipt_total_jpy: 1200,
  merchant: 'SHOP A'
});

const invalidJson = JSON.stringify({
  merchant: 'SHOP A'
});

const ok = runWithResponse(receiptJson);
expect(ok.statusOut === 'DONE', 'receipt success should be DONE');
expect(ok.jsonStr === receiptJson, 'receipt success should return json');
expect(ok.errorCode === '', 'receipt success errorCode should be empty');

const invalid = runWithResponse(invalidJson);
expect(invalid.throwError.indexOf('INVALID_SCHEMA') >= 0, 'invalid schema should throw INVALID_SCHEMA');
expect(invalid.jsonStr === invalidJson, 'invalid schema should keep json for error handling');

const pdfRes = runWithResponse(receiptJson, { mimeType: 'application/pdf' });
expect(pdfRes.statusOut === 'ERROR_FINAL', 'receipt pdf should be ERROR_FINAL');
expect(pdfRes.errorCode === 'UNSUPPORTED_PDF', 'receipt pdf errorCode mismatch');
expect(pdfRes.jsonStr === '', 'receipt pdf should not return json');

console.log('OK: test_ocr_receipt_pipeline_parity');