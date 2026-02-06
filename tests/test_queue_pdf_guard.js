const { loadFilesInOrder } = require('./helpers/module_loader');
const { MockSpreadsheet, bytesFromString } = require('./helpers/mock_sheet');
const { expectTrue, expectEqual } = require('./helpers/assertions');

const sandbox = loadFilesInOrder([
  'gas/Config.js',
  'gas/DocTypeRegistry.js',
  'gas/Log.js',
  'gas/Sheet.js',
  'gas/Drive.js',
  'gas/Pdf.js',
  'gas/Gemini.js',
  'gas/Code.js',
  'gas/Queue.js'
]);

const checkPdf = sandbox.belle_queue_checkPdfPageCount_;
const appendQueue = sandbox.belle_appendQueueSkipLogRows_;
expectTrue(typeof checkPdf === 'function', 'missing belle_queue_checkPdfPageCount_');
expectTrue(typeof appendQueue === 'function', 'missing belle_appendQueueSkipLogRows_');

function makeFile(id, name, mimeType, content) {
  return {
    getId: () => id,
    getName: () => name,
    getMimeType: () => mimeType,
    getBlob: () => ({ getBytes: () => bytesFromString(content) })
  };
}

const multi = makeFile('f1', 'multi.pdf', 'application/pdf', '/Type /Page x /Type /Page');
const unknown = makeFile('f2', 'unknown.pdf', 'application/pdf', '/Type /Pages');
const single = makeFile('f3', 'single.pdf', 'application/pdf', '/Type /Page');

const queued = [];
const skipped = [];
const resMulti = checkPdf(multi, 'receipt', 'receipt');
const resUnknown = checkPdf(unknown, 'cc_statement', 'cc_statement');
const resSingle = checkPdf(single, 'receipt', 'receipt');

if (resMulti) skipped.push(resMulti); else queued.push(multi);
if (resUnknown) skipped.push(resUnknown); else queued.push(unknown);
if (resSingle) skipped.push(resSingle); else queued.push(single);

expectEqual(skipped.length, 2, 'should skip 2 pdfs');
expectEqual(queued.length, 1, 'should queue 1 pdf');
expectTrue(resMulti && resMulti.reason === 'MULTI_PAGE_PDF', 'multi-page reason mismatch');
expectTrue(resUnknown && resUnknown.reason === 'PDF_PAGECOUNT_UNKNOWN', 'unknown-pagecount reason mismatch');
expectTrue(resSingle === null, 'single-page pdf should be allowed');

const ss = new MockSpreadsheet();
appendQueue(ss, skipped, '2025-01-01T00:00:00Z', { getProperty: () => '' });
const sh = ss.getSheetByName('QUEUE_SKIP_LOG');
expectTrue(sh, 'QUEUE_SKIP_LOG should be created');
expectEqual(sh.data.length, 3, 'QUEUE_SKIP_LOG should contain header + 2 rows');

console.log('OK: test_queue_pdf_guard');
