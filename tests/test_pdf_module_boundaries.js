const fs = require('fs');
const path = require('path');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const gasDir = 'gas';
const files = fs.readdirSync(gasDir).filter((f) => f.endsWith('.js'));
const pattern = /function\s+(belle_pdf_[A-Za-z0-9_]+)\s*\(/g;

let pdfDefs = [];
const offenders = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
  const matches = [];
  let m = null;
  while ((m = pattern.exec(content)) !== null) {
    matches.push(m[1]);
  }
  if (matches.length === 0) continue;
  if (file === 'Pdf_v0.js') {
    pdfDefs = pdfDefs.concat(matches);
  } else {
    offenders.push({ file, names: matches });
  }
}

expect(pdfDefs.length > 0, 'expected belle_pdf_* definitions in gas/Pdf_v0.js');
expect(offenders.length === 0, 'belle_pdf_* definitions found outside Pdf_v0.js: ' + JSON.stringify(offenders));

console.log('OK: test_pdf_module_boundaries');
