const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { console };
vm.createContext(sandbox);

let threw = false;
try {
  vm.runInContext(fs.readFileSync('gas/Review.js', 'utf8'), sandbox);
} catch (e) {
  threw = true;
}
expect(threw === false, 'Review.js should load before Export.js without throwing');

vm.runInContext(fs.readFileSync('gas/Export.js', 'utf8'), sandbox);

const res = sandbox.belle_export_runDocTypes({
  receipt: () => ({ ok: true })
});
expect(res && res.receipt && res.receipt.ok === true, 'wrapper should call internal export runner');

console.log('OK: test_export_module_load_order_safety');
