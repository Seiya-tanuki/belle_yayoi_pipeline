const { loadFilesInOrder } = require('./helpers/module_loader');
const { expectTrue, expectEqual } = require('./helpers/assertions');

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

const plan1 = sandbox.belle_ocr_buildClaimScanPlan_(5, "2", 2);
expectTrue(Array.isArray(plan1.indices), 'indices should be array');
expectEqual(plan1.indices.join(','), '2,3', 'plan1 indices mismatch');
expectEqual(plan1.nextCursor, 4, 'plan1 nextCursor mismatch');

const plan2 = sandbox.belle_ocr_buildClaimScanPlan_(5, "10", 2);
expectEqual(plan2.indices.join(','), '0,1', 'plan2 indices mismatch');
expectEqual(plan2.nextCursor, 2, 'plan2 nextCursor mismatch');

const plan3 = sandbox.belle_ocr_buildClaimScanPlan_(5, "", 0);
expectEqual(plan3.indices.length, 5, 'plan3 should scan all');
expectEqual(plan3.nextCursor, 0, 'plan3 nextCursor mismatch');

console.log('OK: test_ocr_claim_cursor');
