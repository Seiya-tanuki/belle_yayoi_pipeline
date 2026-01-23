const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/YayoiExport_v0.js', 'utf8');
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
const buildRows = sandbox.belle_yayoi_buildCcRowsFromStage2_;

expect(typeof parseFiscal === 'function', 'missing belle_yayoi_parseFiscalRangeAllowCrossYear_');
expect(typeof buildRows === 'function', 'missing belle_yayoi_buildCcRowsFromStage2_');

const fiscal = parseFiscal('2025-04-01', '2026-03-31');
expect(fiscal.ok, 'fiscal range should allow cross-year');

const parsed = {
  task: 'transaction_extraction',
  visible_row_count: 3,
  transactions: [
    {
      row_no: 1,
      raw_use_date_text: '7月15日',
      use_month: 7,
      use_day: 15,
      merchant: 'SHOP A',
      amount_yen: 1500,
      amount_sign: 'debit',
      issues: []
    },
    {
      row_no: 2,
      raw_use_date_text: '3月15日',
      use_month: 3,
      use_day: 15,
      merchant: 'SHOP B',
      amount_yen: 2200,
      amount_sign: 'debit',
      issues: ['year_missing']
    },
    {
      row_no: 3,
      raw_use_date_text: '3月16日',
      use_month: 3,
      use_day: 16,
      merchant: 'SHOP C',
      amount_yen: 500,
      amount_sign: 'credit',
      issues: []
    }
  ]
};

const built = buildRows(parsed, { fileId: 'fid001', fileName: 'cc.pdf', docType: 'cc_statement' }, fiscal);
expect(built.rows.length === 2, 'credit rows should be skipped');
expect(built.skipDetails.length === 1, 'one credit row should be logged');
expect(built.skipDetails[0].reason === 'CC_CREDIT_UNSUPPORTED', 'credit skip reason mismatch');

const row1 = built.rows[0];
expect(row1[0] === '2000', 'A column should be 2000');
expect(row1[4] === '仮払金', 'E column should be 仮払金');
expect(row1[7] === '課対仕入込10%適格', 'H column should be fixed tax kubun');
expect(row1[10] === '未払金', 'K column should be 未払金');
expect(row1[13] === '対象外', 'N column should be 対象外');
expect(row1[19] === '0', 'T column should be 0');
expect(row1[3] === '2025/07/15', 'date should use fiscal start year');
expect(row1[21].includes('FID=fid001'), 'memo should include file id');
expect(row1[21].includes('ROW=1'), 'memo should include row number');

const row2 = built.rows[1];
expect(row2[3] === '2026/03/15', 'date should use fiscal end year');

console.log('OK: test_cc_statement_export');
