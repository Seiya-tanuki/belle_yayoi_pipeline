const { createSandbox, runSourcesInOrder, loadFilesInOrder } = require('./helpers/module_loader');
const { expectTrue, expectArrayEqual } = require('./helpers/assertions');

const inlineSandbox = createSandbox({ order: [] });
runSourcesInOrder(
  [
    { filename: 'first.js', code: 'order.push("first");' },
    { filename: 'second.js', code: 'order.push("second"); this.inlineLoaded = true;' }
  ],
  inlineSandbox
);
expectArrayEqual(inlineSandbox.order, ['first', 'second'], 'inline source order mismatch');
expectTrue(inlineSandbox.inlineLoaded === true, 'inline source should update sandbox');

const fileSandbox = loadFilesInOrder(['gas/Config.js', 'gas/DocTypeRegistry.js']);
expectTrue(typeof fileSandbox.belle_docType_getSupportedDocTypes_ === 'function', 'missing doc type function');

console.log('OK: t1_helper_module_loader_smoke');
