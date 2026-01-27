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
  vm.runInContext(fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before Sheet.js without throwing');

vm.runInContext(fs.readFileSync('gas/Sheet.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_exportLog_buildHeaderMap_ === 'function', 'missing belle_exportLog_buildHeaderMap_ after Sheet.js load');
const sheet = {
  getLastColumn: () => 1,
  getRange: () => ({
    getValues: () => [["file_id"]]
  })
};
const res = sandbox.belle_exportLog_buildHeaderMap_(sheet, ["file_id"]);
expect(res && res.ok === true, 'belle_exportLog_buildHeaderMap_ should return ok=true');

console.log('OK: test_sheet_module_load_order_safety');


