const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildCode() {
  return fs.readFileSync('gas/Config.js', 'utf8')
    + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrPrompt.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrValidation.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrCommon.js', 'utf8')
    + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrReceiptPipeline.js', 'utf8');
}

function buildSandbox(receiptJson) {
  const captured = { options: null };
  const sandbox = {
    console,
    Logger: { log: () => {} },
    Utilities: {
      base64Encode: () => 'BASE64'
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        captured.options = options;
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            candidates: [{ content: { parts: [{ text: receiptJson }] } }]
          })
        };
      }
    },
    DriveApp: {
      getFileById: () => ({
        getBlob: () => ({
          getContentType: () => 'image/png',
          getBytes: () => [1, 2, 3]
        })
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(buildCode(), sandbox);
  return { sandbox, captured };
}

function buildProps(extra) {
  const store = Object.assign({
    BELLE_GEMINI_API_KEY: 'KEY',
    BELLE_GEMINI_MODEL: 'model-x',
    BELLE_GEMINI_SLEEP_MS: '500',
    BELLE_MAX_ITEMS_PER_RUN: '1'
  }, extra || {});
  return {
    getProperty: (key) => store[key] || ''
  };
}

const receiptJson = JSON.stringify({
  receipt_total_jpy: 1200,
  merchant: 'SHOP A'
});

const { sandbox, captured } = buildSandbox(receiptJson);
const props = buildProps({
  BELLE_OCR_GENCFG_JSON__receipt__stage1: '{"temperature":0.2,"topP":0.5,"maxOutputTokens":512}'
});

sandbox.belle_cfg_getProps_ = () => props;

const res = sandbox.belle_ocr_receipt_runOnce_({
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
});

expect(res.statusOut === 'DONE', 'receipt run should succeed');
expect(captured.options && captured.options.payload, 'should capture payload');
const payload = JSON.parse(captured.options.payload);
expect(payload.generationConfig.temperature === 0.2, 'override temperature should apply');
expect(payload.generationConfig.topP === 0.5, 'override topP should apply');
expect(payload.generationConfig.maxOutputTokens === 512, 'override maxOutputTokens should apply');

console.log('OK: test_ocr_receipt_gencfg_override');
