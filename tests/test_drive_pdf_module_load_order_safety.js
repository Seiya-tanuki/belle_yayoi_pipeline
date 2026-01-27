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
  vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before Drive/Pdf modules without throwing');

vm.runInContext(fs.readFileSync('gas/Drive.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/Pdf.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_listFilesInFolder === 'function', 'missing belle_listFilesInFolder after Drive.js load');
expect(typeof sandbox.belle_pdf_countPages_ === 'function', 'missing belle_pdf_countPages_ after Pdf.js load');

console.log('OK: test_drive_pdf_module_load_order_safety');

