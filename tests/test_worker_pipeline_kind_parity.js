const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8');

const sandbox = { console, Logger: { log: () => {} } };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ccSpec = sandbox.belle_docType_getSpec_('cc_statement');
const receiptSpec = sandbox.belle_docType_getSpec_('receipt');
const bankSpec = sandbox.belle_docType_getSpec_('bank_statement');
expect(ccSpec.pipeline_kind === 'two_stage', 'cc pipeline_kind should be two_stage');
expect(receiptSpec.pipeline_kind === 'single_stage', 'receipt pipeline_kind should be single_stage');
expect(bankSpec.pipeline_kind === 'single_stage', 'bank pipeline_kind should be single_stage');

expect(sandbox.belle_ocr_shouldStopAfterItem_('cc_statement') === true, 'cc should stop after item');
expect(sandbox.belle_ocr_shouldStopAfterItem_('receipt') === false, 'receipt should not stop after item');
expect(sandbox.belle_ocr_shouldStopAfterItem_('bank_statement') === true, 'bank should stop after item');

expect(sandbox.belle_ocr_allowPdfForDocType_('cc_statement') === true, 'cc should allow pdf');
expect(sandbox.belle_ocr_allowPdfForDocType_('receipt') === true, 'receipt should allow pdf');
expect(sandbox.belle_ocr_allowPdfForDocType_('bank_statement') === true, 'bank should allow pdf');

console.log('OK: test_worker_pipeline_kind_parity');




