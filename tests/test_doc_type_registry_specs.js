const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue_v0.js', 'utf8');

const sandbox = { console, Logger: { log: () => {} } };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const supported = sandbox.belle_docType_getSupportedDocTypes_();
expect(supported.join(',') === 'receipt,cc_statement,bank_statement', 'supported doc types mismatch');

const receiptSpec = sandbox.belle_docType_getSpec_('receipt');
expect(receiptSpec.doc_type === 'receipt', 'receipt doc_type mismatch');
expect(receiptSpec.source_subfolder_name === 'receipt', 'receipt subfolder mismatch');
expect(receiptSpec.export_subfolder_name === 'receipt', 'receipt export subfolder mismatch');
expect(receiptSpec.ocr_sheet_name_default === 'OCR_RECEIPT', 'receipt default sheet mismatch');
expect(typeof receiptSpec.ocr_sheet_name_getter === 'function', 'receipt sheet getter missing');
expect(receiptSpec.ocr_sheet_name_getter({ getProperty: () => '' }) === 'OCR_RECEIPT', 'receipt sheet getter default mismatch');
expect(receiptSpec.pipeline_kind === 'single_stage', 'receipt pipeline_kind mismatch');
expect(receiptSpec.export_handler_key === 'receipt', 'receipt export handler key mismatch');
expect(receiptSpec.stage1_prompt_getter === null, 'receipt stage1 prompt getter should be null');

const ccSpec = sandbox.belle_docType_getSpec_('cc_statement');
expect(ccSpec.doc_type === 'cc_statement', 'cc doc_type mismatch');
expect(ccSpec.source_subfolder_name === 'cc_statement', 'cc subfolder mismatch');
expect(ccSpec.export_subfolder_name === 'cc_statement', 'cc export subfolder mismatch');
expect(ccSpec.ocr_sheet_name_default === 'OCR_CC', 'cc default sheet mismatch');
expect(typeof ccSpec.ocr_sheet_name_getter === 'function', 'cc sheet getter missing');
expect(ccSpec.ocr_sheet_name_getter({ getProperty: () => '' }) === 'OCR_CC', 'cc sheet getter default mismatch');
expect(ccSpec.pipeline_kind === 'two_stage', 'cc pipeline_kind mismatch');
expect(ccSpec.export_handler_key === 'cc_statement', 'cc export handler key mismatch');
expect(typeof ccSpec.stage1_prompt_getter === 'function', 'cc stage1 prompt getter missing');
expect(typeof ccSpec.stage2_prompt_getter === 'function', 'cc stage2 prompt getter missing');

const bankSpec = sandbox.belle_docType_getSpec_('bank_statement');
expect(bankSpec.doc_type === 'bank_statement', 'bank doc_type mismatch');
expect(bankSpec.source_subfolder_name === 'bank_statement', 'bank subfolder mismatch');
expect(bankSpec.export_subfolder_name === 'bank_statement', 'bank export subfolder mismatch');
expect(bankSpec.ocr_sheet_name_default === 'OCR_BANK', 'bank default sheet mismatch');
expect(typeof bankSpec.ocr_sheet_name_getter === 'function', 'bank sheet getter missing');
expect(bankSpec.ocr_sheet_name_getter({ getProperty: () => '' }) === 'OCR_BANK', 'bank sheet getter default mismatch');
expect(bankSpec.pipeline_kind === 'single_stage', 'bank pipeline_kind mismatch');
expect(bankSpec.export_handler_key === 'bank_statement', 'bank export handler key mismatch');
expect(typeof bankSpec.stage2_prompt_getter === 'function', 'bank stage2 prompt getter missing');

console.log('OK: test_doc_type_registry_specs');




