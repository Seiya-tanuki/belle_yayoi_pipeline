const fs = require('fs');
const path = require('path');

const allowlist = new Set([
  'DocTypeRegistry.js',
  'OcrPrompt.js',
  'OcrPromptBankStatement.js'
]);

const tokenRe = /(['"`])([^'"`]*\\b(receipt|cc_statement|bank_statement)\\b[^'"`]*)\\1/g;

const gasDir = 'gas';
const files = fs.readdirSync(gasDir).filter((name) => name.endsWith('.js'));
const violations = [];

for (const name of files) {
  if (allowlist.has(name)) continue;
  const fullPath = path.join(gasDir, name);
  const text = fs.readFileSync(fullPath, 'utf8');
  let match;
  while ((match = tokenRe.exec(text)) !== null) {
    const snippet = match[0].slice(0, 80);
    violations.push({ file: name, snippet });
  }
}

if (violations.length > 0) {
  const lines = violations.map((v) => `${v.file}: ${v.snippet}`);
  throw new Error('doc_type literals must be in DocTypeRegistry.js only:\n' + lines.join('\n'));
}

console.log('OK: test_no_doc_type_literals_outside_registry');
