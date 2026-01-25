const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/YayoiExport_v0.js', 'utf8');
const sandbox = {
  console,
  Utilities: {
    newBlob: (input) => ({
      getBytes: () => Buffer.from(String(input), 'utf8')
    })
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runCase(name, parsed) {
  const rateInfo = sandbox.belle_yayoi_determineSingleRate(parsed);
  const ridInfo = sandbox.belle_yayoi_pickRidAndFix(parsed, rateInfo);
  return { name, rateInfo, ridInfo };
}

const benign = JSON.parse(fs.readFileSync('tests/fixtures/parking_200.json', 'utf8'));
const benignRes = runCase('benign', benign);
expect(benignRes.ridInfo.rid === 'OK', 'benign issues should be OK');
expect(benignRes.ridInfo.fix === '', 'benign issues should not set FIX');

const nonBenign = {
  tax_meta: { tax_rate_printed: 10 },
  overall_issues: [{ code: 'SOME_OTHER' }]
};
const nonBenignRes = runCase('nonBenign', nonBenign);
expect(nonBenignRes.ridInfo.rid === 'OCR_ISSUES', 'non-benign issues should be OCR_ISSUES');
expect(nonBenignRes.ridInfo.fix !== '', 'non-benign issues should set FIX');

const unusual = {
  tax_meta: { tax_rate_printed: 10 },
  overall_issues: [{ code: 'UNUSUAL_FORMAT' }]
};
const unusualRes = runCase('unusual', unusual);
expect(unusualRes.ridInfo.rid === 'UNUSUAL_FORMAT', 'UNUSUAL_FORMAT should win');

const taxUnknown = { overall_issues: [] };
const taxUnknownRes = runCase('taxUnknown', taxUnknown);
expect(taxUnknownRes.ridInfo.rid === 'TAX_UNKNOWN', 'rate null should be TAX_UNKNOWN');

console.log('OK: test_rid_fix_overall_issues');


