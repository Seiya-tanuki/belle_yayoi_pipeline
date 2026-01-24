const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const countPages = sandbox.belle_pdf_countPages_;
expect(typeof countPages === 'function', 'missing belle_pdf_countPages_');

function blobFromString(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  return { getBytes: () => bytes };
}

const one = blobFromString('x/Type /Page y');
const two = blobFromString('/Type /Page x /Type /Page');
const pagesOnly = blobFromString('/Type /Pages');

expect(countPages(one) === 1, 'should count single /Type /Page');
expect(countPages(two) === 2, 'should count two /Type /Page');
expect(countPages(pagesOnly) === null, 'should not count /Type /Pages');

const boom = { getBytes: () => { throw new Error('boom'); } };
expect(countPages(boom) === null, 'should return null on exception');

console.log('OK: test_pdf_page_count');
