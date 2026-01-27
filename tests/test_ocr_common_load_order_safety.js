const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { console };
vm.createContext(sandbox);

let threw = false;
try {
  vm.runInContext(fs.readFileSync('gas/OcrWorkerParallel.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'OcrWorkerParallel.js should load before OcrCommon.js without throwing');

vm.runInContext(fs.readFileSync('gas/OcrCommon.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_perf_getHeaderV2_ === 'function', 'missing belle_perf_getHeaderV2_ after OcrCommon.js load');
expect(typeof sandbox.belle_ocr_worker_calcBackoffMs_ === 'function', 'missing belle_ocr_worker_calcBackoffMs_ after OcrCommon.js load');

console.log('OK: test_ocr_common_load_order_safety');