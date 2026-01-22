const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const isIncomplete = sandbox.belle_ocr_cc_isIncompleteRows_;
const buildMsg = sandbox.belle_ocr_cc_buildIncompleteMessage_;
const allowPdf = sandbox.belle_ocr_allowPdfForDocType_;
const classifyStage1 = sandbox.belle_ocr_cc_classifyStage1Page_;

expect(typeof isIncomplete === 'function', 'missing belle_ocr_cc_isIncompleteRows_');
expect(typeof buildMsg === 'function', 'missing belle_ocr_cc_buildIncompleteMessage_');
expect(typeof allowPdf === 'function', 'missing belle_ocr_allowPdfForDocType_');
expect(typeof classifyStage1 === 'function', 'missing belle_ocr_cc_classifyStage1Page_');

expect(isIncomplete(30, 17) === true, 'incomplete rows should be true');
expect(isIncomplete(10, 10) === false, 'incomplete rows should be false when equal');
expect(buildMsg(17, 30) === 'incomplete rows: extracted=17 visible=30', 'incomplete message mismatch');

expect(allowPdf('cc_statement') === true, 'cc_statement should allow PDF');
expect(allowPdf('receipt') === false, 'receipt should not allow PDF');

const nonTrans = classifyStage1('non_transactions');
expect(nonTrans.proceed === false, 'non_transactions should not proceed');
expect(nonTrans.statusOut === 'ERROR_FINAL', 'non_transactions should be ERROR_FINAL');
expect(nonTrans.errorCode === 'CC_NON_TRANSACTION_PAGE', 'non_transactions errorCode mismatch');

console.log('OK: test_cc_statement_flow');
