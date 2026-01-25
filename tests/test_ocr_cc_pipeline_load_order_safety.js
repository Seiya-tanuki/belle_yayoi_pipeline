const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { console };
vm.createContext(sandbox);

let threw = false;
try {
  vm.runInContext(fs.readFileSync('gas/OcrWorkerParallel_v0.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'OcrWorkerParallel_v0.js should load before OcrCcPipeline_v0.js without throwing');

vm.runInContext(fs.readFileSync('gas/OcrCcPipeline_v0.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_ocr_cc_runOnce_ === 'function', 'missing belle_ocr_cc_runOnce_ after OcrCcPipeline_v0.js load');

console.log('OK: test_ocr_cc_pipeline_load_order_safety');