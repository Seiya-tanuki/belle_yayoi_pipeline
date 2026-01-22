const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/OcrParallelTrigger_v0.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const compute = sandbox.belle_ocr_parallel_computeStaggerMs_;
const hashSlot = sandbox.belle_ocr_parallel_hashSlot_;
expect(typeof compute === 'function', 'compute helper should exist');
expect(typeof hashSlot === 'function', 'hash helper should exist');

const windowMs = 50000;
const expected5 = [0, 10000, 20000, 30000, 40000];
for (let i = 0; i < expected5.length; i++) {
  const out = compute(5, windowMs, i);
  expect(out === expected5[i], '5 workers slot ' + i + ' mismatch');
}

const expected10 = [0, 5000, 10000];
for (let i = 0; i < expected10.length; i++) {
  const out = compute(10, windowMs, i);
  expect(out === expected10[i], '10 workers slot ' + i + ' mismatch');
}

expect(compute(2, 60000, 1) === 29500, 'window clamp to 59000 failed');
expect(compute(5, -10, 2) === 0, 'negative window should clamp to 0');
expect(compute(0, 50000, 1) === 0, 'workerCount<=0 should return 0');
expect(compute(5, 50000, 6) === 10000, 'slot normalization failed');

expect(hashSlot('a', 10) === 7, 'hash slot mismatch');
expect(hashSlot('a', 0) === 0, 'hash with invalid workerCount should be 0');

console.log('OK: test_ocr_parallel_stagger');
