const fs = require('fs');
const path = require('path');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const gasDir = 'gas';
const files = fs.readdirSync(gasDir).filter((f) => f.endsWith('.js'));
const pattern = /function\s+(belle_sheet_[A-Za-z0-9_]+)\s*\(/g;

let sheetDefs = [];
const offenders = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
  const matches = [];
  let m = null;
  while ((m = pattern.exec(content)) !== null) {
    matches.push(m[1]);
  }
  if (matches.length === 0) continue;
  if (file === 'Sheet_v0.js') {
    sheetDefs = sheetDefs.concat(matches);
  } else {
    offenders.push({ file, names: matches });
  }
}

expect(sheetDefs.length > 0, 'expected belle_sheet_* definitions in gas/Sheet_v0.js');
expect(offenders.length === 0, 'belle_sheet_* definitions found outside Sheet_v0.js: ' + JSON.stringify(offenders));

console.log('OK: test_sheet_module_boundaries');
