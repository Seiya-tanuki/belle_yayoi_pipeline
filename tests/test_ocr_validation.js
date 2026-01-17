const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/OcrValidation_v0.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const valid = JSON.parse(fs.readFileSync('tests/fixtures/ocr_valid.json', 'utf8'));
const empty = JSON.parse(fs.readFileSync('tests/fixtures/ocr_empty.json', 'utf8'));
const invalid = JSON.parse(fs.readFileSync('tests/fixtures/ocr_invalid.json', 'utf8'));

const resValid = sandbox.belle_ocr_validateSchema(valid);
expect(resValid.ok === true, 'valid should pass');

const resEmpty = sandbox.belle_ocr_validateSchema(empty);
expect(resEmpty.ok === false && resEmpty.reason === 'EMPTY_RESPONSE', 'empty should fail');

const resInvalid = sandbox.belle_ocr_validateSchema(invalid);
expect(resInvalid.ok === false, 'invalid should fail');

console.log('OK: test_ocr_validation');
