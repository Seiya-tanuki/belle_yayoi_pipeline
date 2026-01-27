const fs = require('fs');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const common = fs.readFileSync('gas/OcrCommon.js', 'utf8');
const worker = fs.readFileSync('gas/OcrWorkerParallel.js', 'utf8');

const names = [
  'belle_ocr_worker_resolveTtlSeconds_',
  'belle_ocr_worker_resolveMaxItems_',
  'belle_ocr_worker_calcBackoffMs_',
  'belle_ocr_extractHttpStatus_',
  'belle_ocr_perf_truncate_',
  'belle_perf_getHeaderV2_',
  'belle_perf_buildRowV2_'
];

for (const name of names) {
  const re = new RegExp('function\\s+' + name + '\\b');
  expect(re.test(common), 'missing in OcrCommon.js: ' + name);
  expect(!re.test(worker), 'still in OcrWorkerParallel.js: ' + name);
}

console.log('OK: test_ocr_common_module_boundaries');