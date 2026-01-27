const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildCode() {
  return fs.readFileSync('gas/Config.js', 'utf8')
    + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrPromptBankStatement.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrValidation.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrCommon.js', 'utf8')
    + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8')
    + '\n' + fs.readFileSync('gas/OcrBankStatementPipeline.js', 'utf8');
}

function buildSandbox() {
  const captured = { url: '', options: null };
  const logs = [];
  const sandbox = {
    console,
    Logger: { log: (msg) => logs.push(msg) },
    Utilities: {
      base64Encode: () => 'BASE64'
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        captured.url = url;
        captured.options = options;
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"task":"transaction_extraction","transactions":[{"row_no":1,"raw_use_date_text":null,"use_month":null,"use_day":null,"merchant":null,"amount_yen":null,"amount_sign":"unknown","issues":[]}]}' }] } }]
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
  return { sandbox, captured, logs };
}

function buildProps(extra) {
  const store = Object.assign({
    BELLE_GEMINI_API_KEY: 'KEY',
    BELLE_GEMINI_MODEL: 'model-x',
    BELLE_GEMINI_SLEEP_MS: '500',
    BELLE_MAX_ITEMS_PER_RUN: '1',
    BELLE_OCR_RETRY_BACKOFF_SECONDS: '300'
  }, extra || {});
  return {
    getProperty: (key) => store[key] || ''
  };
}

function runOnce(sandbox, props) {
  sandbox.belle_cfg_getProps_ = () => props;
  const ctx = {
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
  };
  return sandbox.belle_ocr_bank_runOnce_(ctx);
}

// Test 1: valid override should apply to generationConfig.
{
  const { sandbox, captured } = buildSandbox();
  const props = buildProps({
    BELLE_OCR_GENCFG_JSON__bank_statement__stage1: '{"temperature":0,"topP":0.1,"maxOutputTokens":512}'
  });
  const res = runOnce(sandbox, props);
  expect(res.statusOut === 'DONE', 'bank run should succeed');
  const payload = JSON.parse(captured.options.payload);
  expect(payload.generationConfig.temperature === 0, 'override temperature should win');
  expect(payload.generationConfig.topP === 0.1, 'override topP should apply');
  expect(payload.generationConfig.maxOutputTokens === 512, 'override maxOutputTokens should apply');
}

// Test 2: invalid JSON should warn and not override generationConfig.
{
  const { sandbox, captured, logs } = buildSandbox();
  const props = buildProps({
    BELLE_OCR_GENCFG_JSON__bank_statement__stage1: '{invalid'
  });
  const res = runOnce(sandbox, props);
  expect(res.statusOut === 'DONE', 'bank run should succeed with invalid override');
  const payload = JSON.parse(captured.options.payload);
  expect(payload.generationConfig.temperature === 0.0, 'temperature should default to 0.0');
  expect(payload.generationConfig.topP === undefined, 'topP should not be set');
  const hasWarn = logs.some((entry) => entry && entry.phase === 'CONFIG_WARN' && entry.key === 'BELLE_OCR_GENCFG_JSON_INVALID__bank_statement__stage1');
  expect(hasWarn, 'invalid JSON should emit CONFIG_WARN');
}

console.log('OK: test_ocr_bank_statement_gen_cfg_override');
