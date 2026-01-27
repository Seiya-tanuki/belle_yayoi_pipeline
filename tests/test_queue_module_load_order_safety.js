const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = {
  console,
  Logger: { log: () => {} }
};

vm.createContext(sandbox);

let threw = false;
try {
  vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('gas/Code.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before Queue.js without throwing');

vm.runInContext(fs.readFileSync('gas/Queue.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_getQueueHeaderColumns === 'function', 'missing belle_getQueueHeaderColumns');
const header = sandbox.belle_getQueueHeaderColumns();
expect(Array.isArray(header) && header.length > 0, 'queue header should be a non-empty array');

expect(typeof sandbox.belle_queue_filterNewFiles_ === 'function', 'missing belle_queue_filterNewFiles_');
const filtered = sandbox.belle_queue_filterNewFiles_([{ id: 'a' }, { id: 'b' }], new Set(['a']));
expect(filtered.length === 1 && filtered[0].id === 'b', 'queue filter should drop existing ids');

console.log('OK: test_queue_module_load_order_safety');
