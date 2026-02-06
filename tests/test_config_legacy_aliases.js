const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8');

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

const q1 = runQueueSheet({}, 'receipt');
expect(q1 === 'OCR_RECEIPT', 'receipt should resolve to OCR_RECEIPT');

const q2 = runQueueSheet({}, 'cc_statement');
expect(q2 === 'OCR_CC', 'cc_statement should resolve to OCR_CC');

const cursorKey = sandbox.belle_ocr_buildClaimCursorKey_('receipt');
const getCursor = sandbox.belle_cfg_getOcrClaimCursorRaw_;

const c1 = getCursor({ getProperty: (key) => ({ [cursorKey]: '7' }[key] || '') }, 'receipt', cursorKey);
expect(c1 === '7', 'receipt cursor should use canonical key');

const c2 = getCursor({ getProperty: (key) => ({ BELLE_OCR_CLAIM_CURSOR__cc_statement: '5' }[key] || '') }, 'cc_statement', 'BELLE_OCR_CLAIM_CURSOR__cc_statement');
expect(c2 === '5', 'doc-type cursor should use canonical key');

console.log('OK: test_config_legacy_aliases');




