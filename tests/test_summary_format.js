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

const parsed = JSON.parse(fs.readFileSync('tests/fixtures/sample_3.json', 'utf8'));
const regNo = parsed.qualified_invoice.registration_number;
const summary = sandbox.belle_yayoi_buildSummary(parsed);
if (!summary.includes(regNo)) {
  throw new Error('registration_number missing in summary: ' + summary);
}

const longMerchant = 'MERCHANT_' + 'X'.repeat(200);
const parsedLong = {
  merchant: longMerchant,
  qualified_invoice: { registration_number: regNo }
};
const summaryLong = sandbox.belle_yayoi_buildSummary(parsedLong);
if (!summaryLong.includes(regNo)) {
  throw new Error('registration_number truncated in long summary: ' + summaryLong);
}

const summaryLabel = sandbox.belle_yayoi_buildSummaryWithLabel(null, 'DUMMY');
if (summaryLabel !== 'DUMMY') {
  throw new Error('label summary mismatch: ' + summaryLabel);
}

const summaryLabelReg = sandbox.belle_yayoi_buildSummaryWithLabel(parsedLong, 'DUMMY');
if (!summaryLabelReg.includes('DUMMY') || !summaryLabelReg.includes(regNo)) {
  throw new Error('label summary missing reg: ' + summaryLabelReg);
}

console.log('OK: summary includes full registration_number');


