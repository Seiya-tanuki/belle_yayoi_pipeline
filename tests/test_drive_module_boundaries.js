const fs = require('fs');
const path = require('path');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const gasDir = 'gas';
const files = fs.readdirSync(gasDir).filter((f) => f.endsWith('.js'));
const drivePattern = /function\s+(belle_drive_[A-Za-z0-9_]+)\s*\(/g;
const listPattern = /function\s+(belle_listFilesInFolder)\s*\(/g;

let driveDefs = [];
let listDefs = [];
const offenders = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
  const driveMatches = [];
  const listMatches = [];
  let m = null;
  while ((m = drivePattern.exec(content)) !== null) {
    driveMatches.push(m[1]);
  }
  while ((m = listPattern.exec(content)) !== null) {
    listMatches.push(m[1]);
  }
  if (driveMatches.length === 0 && listMatches.length === 0) continue;
  if (file === 'Drive.js') {
    driveDefs = driveDefs.concat(driveMatches);
    listDefs = listDefs.concat(listMatches);
  } else {
    offenders.push({ file, names: driveMatches.concat(listMatches) });
  }
}

expect(listDefs.length > 0, 'expected belle_listFilesInFolder in gas/Drive.js');
expect(offenders.length === 0, 'drive helpers found outside Drive.js: ' + JSON.stringify(offenders));

console.log('OK: test_drive_module_boundaries');
