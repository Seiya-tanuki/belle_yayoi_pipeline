const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeIterator(list) {
  let idx = 0;
  return {
    hasNext: () => idx < list.length,
    next: () => list[idx++]
  };
}

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8');

const bankFolder = {
  getName: () => 'bank_statement',
  getId: () => 'bank_folder'
};

const rootFolder = {
  getFiles: () => makeIterator([]),
  getFolders: () => makeIterator([bankFolder])
};

const propsActiveReceipt = {
  getProperty: (key) => {
    if (key === 'BELLE_DRIVE_FOLDER_ID') return 'root';
    if (key === 'BELLE_ACTIVE_DOC_TYPES') return 'receipt';
    return '';
  }
};

const sandbox = {
  console,
  Logger: { log: () => {} },
  CacheService: {
    getScriptCache: () => ({
      get: () => null,
      put: () => {}
    })
  },
  PropertiesService: {
    getScriptProperties: () => propsActiveReceipt
  },
  DriveApp: {
    getFolderById: () => rootFolder
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const typesDefault = sandbox.belle_ocr_getActiveDocTypes_({ getProperty: () => '' });
expect(typesDefault.join(',') === 'receipt', 'default active types should be receipt');

const typesUnknown = sandbox.belle_ocr_getActiveDocTypes_({ getProperty: () => 'unknown' });
expect(typesUnknown.join(',') === 'receipt', 'unknown-only should fall back to receipt');

const typesMixed = sandbox.belle_ocr_getActiveDocTypes_({ getProperty: () => 'unknown,cc_statement' });
expect(typesMixed.join(',') === 'cc_statement', 'unknown token should be ignored');

const listed = sandbox.belle_listFilesInFolder();
const inactive = (listed.skipped || []).filter((row) => row && row.reason === 'DOC_TYPE_INACTIVE');
expect(inactive.length === 1, 'bank_statement should be marked inactive when not active');
expect(inactive[0].doc_type === 'bank_statement', 'inactive doc_type mismatch');

console.log('OK: test_doc_type_registry_inactive_unknown_parity');




