const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Export.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Review.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const runDocTypes = sandbox.belle_export_runDocTypes;
expect(typeof runDocTypes === 'function', 'missing belle_export_runDocTypes');

const calls = [];
const results = runDocTypes({
  cc_statement: () => {
    calls.push('cc');
    throw new Error('cc failed');
  },
  receipt: () => {
    calls.push('receipt');
    return { ok: true };
  }
});

expect(calls.length === 2, 'both handlers should be called');
expect(results.cc_statement.ok === false, 'cc should be marked as failed');
expect(results.receipt.ok === true, 'receipt should be marked as ok');

console.log('OK: test_export_doc_type_orchestration');
