const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildCode() {
  return fs.readFileSync('gas/Config.js', 'utf8')
    + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrValidation.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrCommon.js', 'utf8')
    + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrCcPipeline.js', 'utf8');
}

function buildSandbox(stage2Json) {
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
            candidates: [{ content: { parts: [{ text: stage2Json }] } }]
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
  sandbox.belle_ocr_getCcStage1Prompt_ = () => 'STAGE1_PROMPT';
  sandbox.belle_ocr_getCcStage2Prompt_ = () => 'STAGE2_PROMPT';
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

const stage1Cache = JSON.stringify({
  task: 'page_classification',
  page_type: 'transactions'
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

const { sandbox, captured } = buildSandbox(stage2Ok);
const props = buildProps({
  BELLE_OCR_GENCFG_JSON__cc_statement__stage2: '{"temperature":0.2,"topP":0.5}'
});
sandbox.belle_cfg_getProps_ = () => props;

const res = sandbox.belle_ocr_cc_runOnce_({
  props: props,
  fileId: 'file-id',
  attempt: 1,
  maxAttempts: 3,
  statusBefore: 'QUEUED',
  prevErrorCode: '',
  prevError: '',
  prevErrorDetail: '',
  ocrJsonBefore: stage1Cache,
  backoffSeconds: 300
});

expect(res.statusOut === 'DONE', 'cc stage2 should succeed');
expect(captured.options && captured.options.payload, 'should capture payload');
const payload = JSON.parse(captured.options.payload);
expect(payload.generationConfig.temperature === 0.2, 'override temperature should win');
expect(payload.generationConfig.topP === 0.5, 'override topP should apply');

console.log('OK: test_ocr_cc_gencfg_override_new_key');
