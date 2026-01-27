const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const build = sandbox.belle_ocr_buildInvalidSchemaLogDetail_;
expect(typeof build === 'function', 'helper should exist');

const input = 'a'.repeat(45010);
const out = build(input);
expect(out.length === 45000, 'should truncate to 45000');
expect(out === input.slice(0, 45000), 'should return head slice');

const short = 'abc';
expect(build(short) === short, 'short input should pass through');

console.log('OK: test_ocr_invalid_schema_log_detail');





