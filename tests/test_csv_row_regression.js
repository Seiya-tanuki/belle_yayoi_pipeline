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

const buildRow = sandbox.belle_yayoi_buildRow;
const buildCcRow = sandbox.belle_yayoi_buildCcRow_;
const buildCsvRow = sandbox.belle_yayoi_buildCsvRow;
expect(typeof buildRow === 'function', 'missing belle_yayoi_buildRow');
expect(typeof buildCcRow === 'function', 'missing belle_yayoi_buildCcRow_');
expect(typeof buildCsvRow === 'function', 'missing belle_yayoi_buildCsvRow');

const receiptRow = buildRow({
  date: '2025/04/01',
  debitTaxKubun: 'TAX10',
  gross: 1000,
  summary: 'SHOP R',
  memo: 'MEMO|FID=r1'
});

const jpKariBarai = '\u4EEE\u6255\u91D1';
const jpGenkin = '\u73FE\u91D1';
const jpTaishogai = '\u5BFE\u8C61\u5916';
const jpMibarai = '\u672A\u6255\u91D1';

const expectedReceiptCsv = '"2000","","","2025/04/01","' + jpKariBarai + '","","","TAX10","1000","","' + jpGenkin + '","","","' + jpTaishogai + '","1000","","SHOP R","","","0","","MEMO|FID=r1","","","NO"';
const receiptCsv = buildCsvRow(receiptRow);
expect(receiptCsv === expectedReceiptCsv, 'receipt CSV mismatch');

const ccRow = buildCcRow({
  date: '2025/04/02',
  debitTaxKubun: 'TAX10',
  gross: 1200,
  summary: 'SHOP C',
  memo: 'CC|DT=cc_statement|ROW=1|FID=cc1'
});

const expectedCcCsv = '"2000","","","2025/04/02","' + jpKariBarai + '","","","TAX10","1200","","' + jpMibarai + '","","","' + jpTaishogai + '","1200","","SHOP C","","","0","","CC|DT=cc_statement|ROW=1|FID=cc1","","","NO"';
const ccCsv = buildCsvRow(ccRow);
expect(ccCsv === expectedCcCsv, 'cc CSV mismatch');

console.log('OK: test_csv_row_regression');


