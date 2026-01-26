const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildCode() {
  return fs.readFileSync('gas/Config_v0.js', 'utf8')
    + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrValidation_v0.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrCommon_v0.js', 'utf8')
    + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrCcPipeline_v0.js', 'utf8');
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
    BELLE_MAX_ITEMS_PER_RUN: '1',
    BELLE_GEMINI_TEMPERATURE_DEFAULT: '0.7'
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
const props = buildProps();
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
expect(payload.generationConfig.temperature === 0.7, 'policy temperature should apply');
expect(payload.generationConfig.topP === 0.1, 'topP default should apply');
expect(payload.generationConfig.maxOutputTokens === 8192, 'maxOutputTokens default should apply');
expect(payload.generationConfig.thinkingConfig.thinkingLevel === 'low', 'thinkingConfig default should apply');

console.log('OK: test_ocr_cc_temperature_precedence');
