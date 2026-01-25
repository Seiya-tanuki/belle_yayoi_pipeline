const fs = require('fs');
const path = require('path');

const gasDir = path.join(__dirname, '..', 'gas');
const files = fs.readdirSync(gasDir).filter((name) => name.endsWith('.js'));

const patterns = [
  /function\s+\w+_test\b/,
  /\b\w+_test\s*=\s*function\b/,
  /\b\w+_test\s*=\s*\(/,
];

const offenders = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
  for (const re of patterns) {
    if (re.test(content)) {
      offenders.push(file);
      break;
    }
  }
}

if (offenders.length) {
  throw new Error(`Found *_test entrypoints in gas/: ${offenders.join(', ')}`);
}

console.log('OK: test_no_gas_test_entrypoints');
