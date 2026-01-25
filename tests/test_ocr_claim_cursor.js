const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const plan1 = sandbox.belle_ocr_buildClaimScanPlan_(5, "2", 2);
expect(Array.isArray(plan1.indices), 'indices should be array');
expect(plan1.indices.join(',') === '2,3', 'plan1 indices mismatch');
expect(plan1.nextCursor === 4, 'plan1 nextCursor mismatch');

const plan2 = sandbox.belle_ocr_buildClaimScanPlan_(5, "10", 2);
expect(plan2.indices.join(',') === '0,1', 'plan2 indices mismatch');
expect(plan2.nextCursor === 2, 'plan2 nextCursor mismatch');

const plan3 = sandbox.belle_ocr_buildClaimScanPlan_(5, "", 0);
expect(plan3.indices.length === 5, 'plan3 should scan all');
expect(plan3.nextCursor === 0, 'plan3 nextCursor mismatch');

console.log('OK: test_ocr_claim_cursor');
