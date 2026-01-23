const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const detectStage = sandbox.belle_ocr_cc_detectStageFromCache_;
const stage1Writeback = sandbox.belle_ocr_cc_buildStage1Writeback_;
const stage2Success = sandbox.belle_ocr_cc_buildStage2SuccessWriteback_;
const stage2Incomplete = sandbox.belle_ocr_cc_buildStage2IncompleteWriteback_;
const isIncomplete = sandbox.belle_ocr_cc_isIncompleteRows_;
const buildMsg = sandbox.belle_ocr_cc_buildIncompleteMessage_;
const allowPdf = sandbox.belle_ocr_allowPdfForDocType_;
const classifyStage1 = sandbox.belle_ocr_cc_classifyStage1Page_;
const shouldStop = sandbox.belle_ocr_shouldStopAfterItem_;

expect(typeof detectStage === 'function', 'missing belle_ocr_cc_detectStageFromCache_');
expect(typeof stage1Writeback === 'function', 'missing belle_ocr_cc_buildStage1Writeback_');
expect(typeof stage2Success === 'function', 'missing belle_ocr_cc_buildStage2SuccessWriteback_');
expect(typeof stage2Incomplete === 'function', 'missing belle_ocr_cc_buildStage2IncompleteWriteback_');
expect(typeof isIncomplete === 'function', 'missing belle_ocr_cc_isIncompleteRows_');
expect(typeof buildMsg === 'function', 'missing belle_ocr_cc_buildIncompleteMessage_');
expect(typeof allowPdf === 'function', 'missing belle_ocr_allowPdfForDocType_');
expect(typeof classifyStage1 === 'function', 'missing belle_ocr_cc_classifyStage1Page_');
expect(typeof shouldStop === 'function', 'missing belle_ocr_shouldStopAfterItem_');

const stage1Json = JSON.stringify({
  task: "page_classification",
  page_type: "transactions",
  reason_codes: [],
  page_issues: []
});
const stage2Json = JSON.stringify({
  task: "transaction_extraction",
  visible_row_count: 1,
  transactions: [
    {
      row_no: 1,
      raw_use_date_text: "6月21日",
      use_month: 6,
      use_day: 21,
      merchant: "SHOP A",
      amount_yen: 1200,
      amount_sign: "debit",
      issues: []
    }
  ]
});

const emptyStage = detectStage("");
expect(emptyStage.stage === 'stage1', 'empty cache should go to stage1');
expect(emptyStage.cacheInvalid === false, 'empty cache should not be invalid');

const stage2Ready = detectStage(stage1Json);
expect(stage2Ready.stage === 'stage2', 'stage1 cache should go to stage2');
expect(stage2Ready.cacheInvalid === false, 'stage1 cache should be valid');

const invalidCache = detectStage(stage2Json);
expect(invalidCache.stage === 'stage1', 'non-stage1 cache should go to stage1');
expect(invalidCache.cacheInvalid === true, 'non-stage1 cache should be invalid');

const stage1Tx = stage1Writeback('transactions', stage1Json);
expect(stage1Tx.statusOut === 'QUEUED', 'stage1 transactions should queue');
expect(stage1Tx.cacheJson === stage1Json, 'stage1 cache should be stored');
expect(stage1Tx.clearErrors === true, 'stage1 cache should clear errors');

const stage1Non = stage1Writeback('non_transactions', stage1Json);
expect(stage1Non.statusOut === 'ERROR_FINAL', 'stage1 non_transactions should be ERROR_FINAL');
expect(stage1Non.errorCode === 'CC_NON_TRANSACTION_PAGE', 'stage1 non_transactions errorCode mismatch');
expect(stage1Non.cacheJson === '', 'stage1 non_transactions should not cache');

const stage2Ok = stage2Success(stage2Json);
expect(stage2Ok.statusOut === 'DONE', 'stage2 success should be DONE');
expect(stage2Ok.nextJson === stage2Json, 'stage2 success should overwrite json');
expect(stage2Ok.clearErrors === true, 'stage2 success should clear errors');

const incomplete = stage2Incomplete(stage2Json, 1, 2);
expect(incomplete.statusOut === 'ERROR_RETRYABLE', 'incomplete should be ERROR_RETRYABLE');
expect(incomplete.errorCode === 'CC_INCOMPLETE_ROWS', 'incomplete errorCode mismatch');
expect(incomplete.keepCache === true, 'incomplete should keep cache');

expect(isIncomplete(30, 17) === true, 'incomplete rows should be true');
expect(isIncomplete(10, 10) === false, 'incomplete rows should be false when equal');
expect(buildMsg(17, 30) === 'incomplete rows: extracted=17 visible=30', 'incomplete message mismatch');

expect(allowPdf('cc_statement') === true, 'cc_statement should allow PDF');
expect(allowPdf('receipt') === false, 'receipt should not allow PDF');
expect(shouldStop('cc_statement') === true, 'cc_statement should stop after item');
expect(shouldStop('receipt') === false, 'receipt should not stop after item');

const nonTrans = classifyStage1('non_transactions');
expect(nonTrans.proceed === false, 'non_transactions should not proceed');
expect(nonTrans.statusOut === 'ERROR_FINAL', 'non_transactions should be ERROR_FINAL');
expect(nonTrans.errorCode === 'CC_NON_TRANSACTION_PAGE', 'non_transactions errorCode mismatch');

console.log('OK: test_cc_statement_flow');
