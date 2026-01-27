const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = {
  console,
  Logger: { log: () => {} },
  Utilities: { base64Encode: () => '' }
};

vm.createContext(sandbox);

let threw = false;
try {
  vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before Gemini.js without throwing');

vm.runInContext(fs.readFileSync('gas/Gemini.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_getGeminiConfig === 'function', 'missing belle_getGeminiConfig after Gemini.js load');
expect(typeof sandbox.belle_callGeminiOcr === 'function', 'missing belle_callGeminiOcr after Gemini.js load');

console.log('OK: test_gemini_module_load_order_safety');
