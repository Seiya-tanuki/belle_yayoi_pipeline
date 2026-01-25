const fs = require('fs');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const pipeline = fs.readFileSync('gas/OcrReceiptPipeline_v0.js', 'utf8');
const worker = fs.readFileSync('gas/OcrWorkerParallel_v0.js', 'utf8');

const name = 'belle_ocr_receipt_runOnce_';
const re = new RegExp('function\\s+' + name + '\\b');
expect(re.test(pipeline), 'missing in OcrReceiptPipeline_v0.js: ' + name);
expect(!re.test(worker), 'still in OcrWorkerParallel_v0.js: ' + name);

console.log('OK: test_ocr_receipt_pipeline_boundaries');