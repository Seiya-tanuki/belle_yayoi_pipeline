const { loadFilesInOrder } = require('./helpers/module_loader');
const { expectTrue } = require('./helpers/assertions');

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

const header = sandbox.belle_getQueueHeader_();
expectTrue(Array.isArray(header), 'header should be array');
expectTrue(header.indexOf('doc_type') >= 0, 'missing doc_type');
expectTrue(header.indexOf('source_subfolder') >= 0, 'missing source_subfolder');
expectTrue(header.indexOf('ocr_lock_owner') >= 0, 'missing ocr_lock_owner');
expectTrue(header.indexOf('ocr_lock_until_iso') >= 0, 'missing ocr_lock_until_iso');
expectTrue(header.indexOf('ocr_processing_started_at_iso') >= 0, 'missing ocr_processing_started_at_iso');

const unique = new Set(header);
expectTrue(unique.size === header.length, 'header should not contain duplicates');

console.log('OK: test_ocr_claim_headers');
