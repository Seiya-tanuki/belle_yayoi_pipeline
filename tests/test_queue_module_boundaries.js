const fs = require('fs');
const path = require('path');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const pattern = /function\s+(belle_queue_[A-Za-z0-9_]+)\s*\(/g;

const allowInCode = new Set(['belle_queueFolderFilesToSheet']);
const queueContent = fs.readFileSync(path.join('gas', 'Queue_v0.js'), 'utf8');
const codeContent = fs.readFileSync(path.join('gas', 'Code.js'), 'utf8');

let queueDefs = [];
let m = null;
while ((m = pattern.exec(queueContent)) !== null) {
  queueDefs.push(m[1]);
}

const codeDefs = [];
m = null;
while ((m = pattern.exec(codeContent)) !== null) {
  codeDefs.push(m[1]);
}

const unexpected = codeDefs.filter((name) => !allowInCode.has(name));

expect(queueDefs.length > 0, 'expected belle_queue_* definitions in gas/Queue_v0.js');
expect(unexpected.length === 0, 'unexpected belle_queue_* definitions in gas/Code.js: ' + JSON.stringify(unexpected));

console.log('OK: test_queue_module_boundaries');
