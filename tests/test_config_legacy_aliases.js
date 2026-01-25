const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');

const sandbox = {
  __props: {},
  console,
  Logger: { log: () => {} },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => sandbox.__props[key] || ''
    })
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runQueueSheet(props, docType) {
  sandbox.__props = props || {};
  return sandbox.belle_ocr_getQueueSheetNameForDocType_(null, docType);
}

const q1 = runQueueSheet({ BELLE_QUEUE_SHEET_NAME: 'QUEUE_CUSTOM' }, 'receipt');
expect(q1 === 'QUEUE_CUSTOM', 'queue override should win');

const q2 = runQueueSheet({ BELLE_SHEET_NAME: 'QUEUE_LEGACY' }, 'receipt');
expect(q2 === 'QUEUE_LEGACY', 'legacy queue override should be used');

const q3 = runQueueSheet({}, 'receipt');
expect(q3 === 'OCR_RECEIPT', 'receipt should fall back to OCR_RECEIPT');

const q4 = runQueueSheet({ BELLE_QUEUE_SHEET_NAME: 'QUEUE_CUSTOM' }, 'cc_statement');
expect(q4 === 'OCR_CC', 'cc_statement should ignore receipt override');

const cursorKey = sandbox.belle_ocr_buildClaimCursorKey_('receipt');
const getCursor = sandbox.belle_cfg_getOcrClaimCursorRaw_;

const c1 = getCursor({ getProperty: (key) => ({ BELLE_OCR_CLAIM_CURSOR: '7' }[key] || '') }, 'receipt', cursorKey);
expect(c1 === '7', 'legacy cursor should be used when new key missing');

const c2 = getCursor({ getProperty: (key) => ({ [cursorKey]: '9', BELLE_OCR_CLAIM_CURSOR: '7' }[key] || '') }, 'receipt', cursorKey);
expect(c2 === '9', 'doc-type cursor should win over legacy');

const c3 = getCursor({ getProperty: (key) => ({ BELLE_OCR_CLAIM_CURSOR: '7' }[key] || '') }, 'cc_statement', 'BELLE_OCR_CLAIM_CURSOR__cc_statement');
expect(c3 === '', 'non-receipt should ignore legacy cursor');

console.log('OK: test_config_legacy_aliases');



