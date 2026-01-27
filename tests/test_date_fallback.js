const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n' + fs.readFileSync('gas/YayoiExport.js', 'utf8');
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

const fiscal = sandbox.belle_yayoi_validateFiscalRange('2025-01-01', '2025-12-31');
expect(fiscal.ok, 'fiscal range should be valid');

const noDate = sandbox.belle_yayoi_resolveTransactionDate({}, fiscal);
expect(noDate.dateYmdSlash === '2025/12/31', 'NO_DATE should use fiscal end');
expect(noDate.dateRid === 'DATE_FALLBACK', 'NO_DATE should set RID');
expect(noDate.dateDt === 'NO_DATE', 'NO_DATE should set DT');

const outRange = sandbox.belle_yayoi_resolveTransactionDate({ transaction_date: '2023-08-15' }, fiscal);
expect(outRange.dateYmdSlash === '2025/08/15', 'OUT_OF_RANGE should replace year');
expect(outRange.dateDt === 'OUT_OF_RANGE', 'OUT_OF_RANGE should set DT');

const leap = sandbox.belle_yayoi_resolveTransactionDate({ transaction_date: '2024-02-29' }, fiscal);
expect(leap.dateYmdSlash === '2025/12/31', 'LEAP should use fiscal end');
expect(leap.dateDt === 'LEAP_ADJUST', 'LEAP should set DT');

const inRange = sandbox.belle_yayoi_resolveTransactionDate({ transaction_date: '2025-11-10' }, fiscal);
expect(inRange.dateYmdSlash === '2025/11/10', 'IN_RANGE should keep date');
expect(!inRange.dateRid, 'IN_RANGE should not set RID');

console.log('OK: test_date_fallback');


