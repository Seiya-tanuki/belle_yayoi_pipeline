const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Export.js', 'utf8')
  + '\n' + fs.readFileSync('gas/ExportEntrypoints.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const pick = sandbox.belle_export_pickSingleFolder_;
expect(typeof pick === 'function', 'missing belle_export_pickSingleFolder_');

const none = pick([], 'cc_statement', 'cc_statement', 'parent123');
expect(none.ok === true, 'empty should be ok');
expect(none.folder === null, 'empty should return null folder');
expect(none.foundCount === 0, 'empty foundCount should be 0');

const folder = { id: 'f1' };
const one = pick([folder], 'cc_statement', 'cc_statement', 'parent123');
expect(one.ok === true, 'single should be ok');
expect(one.folder === folder, 'single should return the same folder');
expect(one.foundCount === 1, 'single foundCount should be 1');

const dup = pick([{ id: 'a' }, { id: 'b' }], 'cc_statement', 'cc_statement', 'parent123');
expect(dup.ok === false, 'duplicate should be error');
expect(dup.reason === 'DUPLICATE_OUTPUT_SUBFOLDER_NAME', 'duplicate reason mismatch');
expect(dup.foundCount === 2, 'duplicate count mismatch');
expect(dup.folderName === 'cc_statement', 'duplicate folderName mismatch');
expect(dup.docType === 'cc_statement', 'duplicate docType mismatch');
expect(dup.parentFolderId === 'parent123', 'duplicate parentFolderId mismatch');

console.log('OK: test_export_folder_resolution');
