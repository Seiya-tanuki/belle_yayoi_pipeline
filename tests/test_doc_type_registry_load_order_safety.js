const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = {
  console,
  Logger: { log: () => {} },
  CacheService: {
    getScriptCache: () => ({
      get: () => null,
      put: () => {}
    })
  }
};

vm.createContext(sandbox);

let threw = false;
try {
  vm.runInContext(fs.readFileSync('gas/Config_v0.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before DocTypeRegistry without throwing');

vm.runInContext(fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8'), sandbox);

const props = { getProperty: () => '' };
const types = sandbox.belle_ocr_getActiveDocTypes_(props);
expect(types.join(',') === 'receipt', 'active doc types should default to receipt');

const spec = sandbox.belle_docType_getSpec_('receipt');
expect(spec && spec.doc_type === 'receipt', 'receipt spec should resolve after registry load');

console.log('OK: test_doc_type_registry_load_order_safety');

