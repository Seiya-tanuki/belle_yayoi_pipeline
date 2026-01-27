const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/OcrValidation.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const validateStage2 = sandbox.belle_ocr_validateCcStage2_;
expect(typeof validateStage2 === 'function', 'missing belle_ocr_validateCcStage2_');

const valid = {
  task: "transaction_extraction",
  transactions: [
    {
      row_no: 1,
      raw_use_date_text: "6?21?",
      use_month: 6,
      use_day: 21,
      merchant: "SHOP A",
      amount_yen: 1200,
      amount_sign: "debit",
      issues: []
    },
    {
      row_no: 2,
      raw_use_date_text: "6?22?",
      use_month: 6,
      use_day: 22,
      merchant: "SHOP B",
      amount_yen: 900,
      amount_sign: "credit",
      issues: ["year_missing"]
    }
  ]
};

const res = validateStage2(valid);
expect(res && res.ok === true, 'stage2 validation should pass without description');

console.log('OK: test_cc_statement_validation');
