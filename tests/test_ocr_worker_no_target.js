const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/OcrWorkerParallel_v0.js', 'utf8');
const sandbox = { console };
sandbox.PropertiesService = { getScriptProperties: () => ({ getProperty: () => '' }) };
sandbox.Utilities = { getUuid: () => 'UUID' };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

sandbox.belle_ocr_claimNextRowByDocTypes_ = () => ({ claimed: false, reason: 'NO_TARGET', processingCount: 0 });

let res = null;
try {
  res = sandbox.belle_ocr_workerOnce_fallback_v0_({});
} catch (e) {
  throw new Error('workerOnce should not throw on NO_TARGET');
}

expect(res && res.processed === 0, 'NO_TARGET should return processed=0');
expect(res.processingCount === 0, 'NO_TARGET should include processingCount=0');

console.log('OK: test_ocr_worker_no_target');
