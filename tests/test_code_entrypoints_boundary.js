const fs = require('fs');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const content = fs.readFileSync('gas/Code.js', 'utf8');
const pattern = /function\s+([A-Za-z0-9_]+)\s*\(/g;
const defs = [];
let m = null;
while ((m = pattern.exec(content)) !== null) {
  defs.push(m[1]);
}

const allowlist = [
  'belle_queueFolderFilesToSheet',
  'belle_processQueueOnce',
  'belle_resetSpreadsheetToInitialState'
];

const unexpected = defs.filter((name) => !allowlist.includes(name));
expect(unexpected.length === 0, 'unexpected Code.js functions: ' + JSON.stringify(unexpected));

const forbiddenPrefixes = [
  'belle_log_',
  'belle_sheet_',
  'belle_drive_',
  'belle_pdf_',
  'belle_gemini_',
  'belle_queue_',
  'belle_export_'
];

for (const prefix of forbiddenPrefixes) {
  if (prefix === 'belle_queue_') {
    // allow the single entrypoint wrapper
    continue;
  }
  if (content.indexOf('function ' + prefix) >= 0) {
    throw new Error('unexpected helper prefix in Code.js: ' + prefix);
  }
}

console.log('OK: test_code_entrypoints_boundary');
