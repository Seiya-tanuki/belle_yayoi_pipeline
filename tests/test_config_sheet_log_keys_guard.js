const fs = require('fs');
const path = require('path');

const keys = [
  'BELLE_QUEUE_SHEET_NAME',
  'BELLE_SKIP_LOG_SHEET_NAME',
  'BELLE_QUEUE_SKIP_LOG_SHEET_NAME',
  'BELLE_EXPORT_GUARD_LOG_SHEET_NAME',
];

const regexes = keys.map((key) => new RegExp(`getProperty\\(\\s*['"]${key}['"]`));
const gasDir = path.join(__dirname, '..', 'gas');
const files = fs.readdirSync(gasDir)
  .filter((name) => name.endsWith('.js') && name !== 'Config.js');

const offenders = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
  regexes.forEach((re, idx) => {
    if (re.test(content)) offenders.push(`${file}: ${keys[idx]}`);
  });
}

if (offenders.length) {
  throw new Error(`Direct getProperty use for sheet/log keys outside Config.js: ${offenders.join(', ')}`);
}

console.log('OK: test_config_sheet_log_keys_guard');
