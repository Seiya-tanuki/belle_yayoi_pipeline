const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const props = {
  getProperty: (key) => {
    if (key === 'BELLE_SHEET_ID') return 'SHEET_1';
    if (key === 'BELLE_DRIVE_FOLDER_ID') return 'DRIVE_1';
    if (key === 'BELLE_OUTPUT_FOLDER_ID') return 'OUT_1';
    return '';
  }
};

expect(sandbox.belle_cfg_getSheetIdOrThrow_(props) === 'SHEET_1', 'sheet id mismatch');
expect(sandbox.belle_cfg_getDriveFolderIdOrThrow_(props) === 'DRIVE_1', 'drive folder id mismatch');
expect(sandbox.belle_cfg_getOutputFolderIdOrDriveFolderIdOrThrow_(props) === 'OUT_1', 'output folder id mismatch');
expect(sandbox.belle_getOutputFolderId(props) === 'OUT_1', 'output folder id helper mismatch');

const propsFallback = {
  getProperty: (key) => {
    if (key === 'BELLE_DRIVE_FOLDER_ID') return 'DRIVE_2';
    return '';
  }
};

expect(sandbox.belle_cfg_getOutputFolderIdOrDriveFolderId_(propsFallback) === 'DRIVE_2', 'drive fallback mismatch');
expect(sandbox.belle_getOutputFolderId(propsFallback) === 'DRIVE_2', 'output folder fallback mismatch');

let threw = false;
try {
  sandbox.belle_cfg_getOutputFolderIdOrDriveFolderIdOrThrow_({ getProperty: () => '' });
} catch (e) {
  threw = true;
}
expect(threw, 'missing output folder should throw');

console.log('OK: test_config_core_keys_callsites_smoke');



