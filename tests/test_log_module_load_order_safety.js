const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = {
  console,
  Logger: { log: () => {} },
  Utilities: {
    formatDate: () => '2025-01-01'
  }
};

vm.createContext(sandbox);

let threw = false;
try {
  vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before Log.js without throwing');

vm.runInContext(fs.readFileSync('gas/Log.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_getSkipLogHeader_ === 'function', 'missing belle_getSkipLogHeader_ after Log.js load');
const header = sandbox.belle_getSkipLogHeader_();
expect(Array.isArray(header) && header.length > 0, 'belle_getSkipLogHeader_ should return a header array');

console.log('OK: test_log_module_load_order_safety');



