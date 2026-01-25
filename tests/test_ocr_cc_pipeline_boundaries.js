const fs = require('fs');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const pipeline = fs.readFileSync('gas/OcrCcPipeline_v0.js', 'utf8');
const worker = fs.readFileSync('gas/OcrWorkerParallel_v0.js', 'utf8');

const name = 'belle_ocr_cc_runOnce_';
const re = new RegExp('function\\s+' + name + '\\b');
expect(re.test(pipeline), 'missing in OcrCcPipeline_v0.js: ' + name);
expect(!re.test(worker), 'still in OcrWorkerParallel_v0.js: ' + name);

console.log('OK: test_ocr_cc_pipeline_boundaries');