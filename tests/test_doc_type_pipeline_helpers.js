const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const propsEmpty = { getProperty: () => '' };
const typesDefault = sandbox.belle_ocr_getActiveDocTypes_(propsEmpty);
expect(Array.isArray(typesDefault), 'default doc types should be array');
expect(typesDefault.join(',') === 'receipt', 'default doc types should be receipt');

const propsMulti = { getProperty: (key) => key === 'BELLE_ACTIVE_DOC_TYPES' ? 'receipt,cc_statement,bank_statement,receipt' : '' };
const typesMulti = sandbox.belle_ocr_getActiveDocTypes_(propsMulti);
expect(typesMulti.join(',') === 'receipt,cc_statement,bank_statement', 'active doc types parsing failed');

const propsQueue = { getProperty: (key) => key === 'BELLE_QUEUE_SHEET_NAME' ? 'CUSTOM_QUEUE' : '' };
expect(sandbox.belle_ocr_getQueueSheetNameForDocType_(propsQueue, 'receipt') === 'CUSTOM_QUEUE', 'receipt sheet override failed');
expect(sandbox.belle_ocr_getQueueSheetNameForDocType_(propsQueue, 'cc_statement') === 'OCR_CC', 'cc sheet should ignore receipt override');

const propsEmptyQueue = { getProperty: () => '' };
expect(sandbox.belle_ocr_getQueueSheetNameForDocType_(propsEmptyQueue, 'receipt') === 'OCR_RECEIPT', 'receipt default sheet mismatch');
expect(sandbox.belle_ocr_getQueueSheetNameForDocType_(propsEmptyQueue, 'bank_statement') === 'OCR_BANK', 'bank default sheet mismatch');

const keyReceipt = sandbox.belle_ocr_buildClaimCursorKey_('receipt');
expect(keyReceipt === 'BELLE_OCR_CLAIM_CURSOR__receipt', 'claim cursor key mismatch');
const keyEmpty = sandbox.belle_ocr_buildClaimCursorKey_('');
expect(keyEmpty === 'BELLE_OCR_CLAIM_CURSOR', 'empty claim cursor key mismatch');

const files = [{ id: 'A' }, { id: 'B' }, { id: 'A' }, { id: '' }, {}];
const existing = new Set(['A']);
const filtered = sandbox.belle_queue_filterNewFiles_(files, existing);
expect(filtered.length === 1 && filtered[0].id === 'B', 'queue dedupe failed');

console.log('OK: test_doc_type_pipeline_helpers');
