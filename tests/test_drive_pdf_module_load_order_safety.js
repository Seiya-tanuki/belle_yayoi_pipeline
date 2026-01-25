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
  vm.runInContext(fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue_v0.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before Drive/Pdf modules without throwing');

vm.runInContext(fs.readFileSync('gas/Drive_v0.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/Pdf_v0.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_listFilesInFolder === 'function', 'missing belle_listFilesInFolder after Drive_v0.js load');
expect(typeof sandbox.belle_pdf_countPages_ === 'function', 'missing belle_pdf_countPages_ after Pdf_v0.js load');

console.log('OK: test_drive_pdf_module_load_order_safety');

