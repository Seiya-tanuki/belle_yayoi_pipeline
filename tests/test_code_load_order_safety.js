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
  vm.runInContext(fs.readFileSync('gas/Code.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Code.js should load before Queue_v0.js and Sheet_v0.js without throwing');

vm.runInContext(fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue_v0.js', 'utf8'), sandbox);

expect(typeof sandbox.belle_queueFolderFilesToSheet === 'function', 'missing belle_queueFolderFilesToSheet wrapper');
expect(typeof sandbox.belle_queueFolderFilesToSheetInternal_ === 'function', 'missing belle_queueFolderFilesToSheetInternal_');

sandbox.belle_queueFolderFilesToSheetInternal_ = () => 'ok';
const queueResult = sandbox.belle_queueFolderFilesToSheet();
expect(queueResult === 'ok', 'queue wrapper should call internal implementation');

expect(typeof sandbox.belle_resetSpreadsheetToInitialState === 'function', 'missing belle_resetSpreadsheetToInitialState wrapper');
expect(typeof sandbox.belle_resetSpreadsheetToInitialStateInternal_ === 'function', 'missing belle_resetSpreadsheetToInitialStateInternal_');

sandbox.belle_resetSpreadsheetToInitialStateInternal_ = () => 'ok';
const resetResult = sandbox.belle_resetSpreadsheetToInitialState();
expect(resetResult === 'ok', 'reset wrapper should call internal implementation');

console.log('OK: test_code_load_order_safety');
