const fs = require('fs');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const src = fs.readFileSync('gas/OcrWorkerParallel_v0.js', 'utf8');

const forbidden = [
  /\bCC_/,
  /UNSUPPORTED_PDF/,
  /transaction_extraction/,
  /page_classification/
];

for (const re of forbidden) {
  expect(!re.test(src), 'forbidden token in OcrWorkerParallel_v0.js: ' + re);
}

console.log('OK: test_ocr_worker_orchestrator_boundaries');
