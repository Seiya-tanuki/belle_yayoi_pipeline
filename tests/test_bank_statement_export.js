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

const parseFiscal = sandbox.belle_yayoi_parseFiscalRangeAllowCrossYear_;
const buildRows = sandbox.belle_yayoi_buildBankRowsFromStage2_;

expect(typeof parseFiscal === 'function', 'missing belle_yayoi_parseFiscalRangeAllowCrossYear_');
expect(typeof buildRows === 'function', 'missing belle_yayoi_buildBankRowsFromStage2_');

const fiscal = parseFiscal('2025-04-01', '2026-03-31');
expect(fiscal.ok, 'fiscal range should allow cross-year');

const parsed = {
  task: 'transaction_extraction',
  transactions: [
    {
      row_no: 1,
      raw_use_date_text: '4/1',
      use_month: 4,
      use_day: 1,
      merchant: 'BANK SHOP',
      amount_yen: 1500,
      amount_sign: 'debit',
      issues: []
    },
    {
      row_no: 2,
      raw_use_date_text: '4/2',
      use_month: 4,
      use_day: 2,
      merchant: 'BANK CREDIT',
      amount_yen: 2100,
      amount_sign: 'credit',
      issues: ['note']
    },
    {
      row_no: 3,
      raw_use_date_text: '4/3',
      use_month: 4,
      use_day: 3,
      merchant: 'BANK UNKNOWN',
      amount_yen: 500,
      amount_sign: 'unknown',
      issues: []
    },
    {
      row_no: 4,
      raw_use_date_text: '4/4',
      use_month: 4,
      use_day: 4,
      merchant: 'BANK MISSING',
      amount_sign: 'debit',
      issues: []
    }
  ]
};

const built = buildRows(parsed, { fileId: 'fid001', fileName: 'bank.pdf', docType: 'bank_statement' }, fiscal);
expect(built.rows.length === 2, 'should export debit and credit rows');
expect(built.skipDetails.length === 2, 'should log two skipped rows');

const reasons = built.skipDetails.map((d) => d.reason).sort();
expect(reasons[0] === 'BANK_AMOUNT_MISSING', 'missing amount skip reason mismatch');
expect(reasons[1] === 'BANK_AMOUNT_SIGN_UNKNOWN', 'unknown sign skip reason mismatch');

const row1 = built.rows[0];
expect(row1[0] === '2000', 'A column should be 2000');
expect(row1[4] === '現金', 'debit account should be 現金');
expect(row1[10] === '仮払金', 'credit account should be 仮払金');
expect(row1[7] === '課対仕入込10%適格', 'H column should be fixed tax kubun');
expect(row1[13] === '対象外', 'N column should be 対象外');
expect(row1[19] === '0', 'T column should be 0');
expect(row1[3] === '2025/04/01', 'date should use fiscal start year');
expect(row1[21].includes('FID=fid001'), 'memo should include file id');
expect(row1[21].includes('ROW=1'), 'memo should include row number');
expect(row1[21].includes('SIGN=debit'), 'memo should include amount_sign');
expect(row1[21].includes('AMT=1500'), 'memo should include amount');

const row2 = built.rows[1];
expect(row2[4] === '仮払金', 'credit row debit account should be 仮払金');
expect(row2[10] === '現金', 'credit row credit account should be 現金');
expect(row2[21].includes('SIGN=credit'), 'memo should include credit sign');

console.log('OK: test_bank_statement_export');
