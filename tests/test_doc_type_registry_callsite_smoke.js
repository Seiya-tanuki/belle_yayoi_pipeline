const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Log.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Export.js', 'utf8') + '\n' + fs.readFileSync('gas/ExportEntrypoints.js', 'utf8');

const calls = [];
const sandbox = {
  console,
  Logger: { log: () => {} },
  DriveApp: {
    getFolderById: () => ({
      getFoldersByName: (name) => {
        calls.push({ method: 'getFoldersByName', name });
        let idx = 0;
        return {
          hasNext: () => idx < 0,
          next: () => null
        };
      },
      createFolder: (name) => ({ name })
    })
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const defs = sandbox.belle_getDocTypeDefs_();
expect(defs.length >= 2, 'doc type defs should be present');
expect(defs[0].docType === 'receipt', 'first doc type should be receipt');

const receiptDef = sandbox.belle_ocr_getDocTypeDefByDocType_('receipt');
expect(receiptDef && receiptDef.sheetName === 'OCR_RECEIPT', 'receipt def sheet mismatch');
const ccDef = sandbox.belle_ocr_getDocTypeDefByDocType_('cc_statement');
expect(ccDef && ccDef.sheetName === 'OCR_CC', 'cc def sheet mismatch');

sandbox.belle_export_resolveOutputFolderByDocType_('out', 'receipt');
sandbox.belle_export_resolveOutputFolderByDocType_('out', 'cc_statement');
expect(calls.length === 2, 'export folder lookup count mismatch');
expect(calls[0].name === 'receipt', 'receipt export subfolder mismatch');
expect(calls[1].name === 'cc_statement', 'cc export subfolder mismatch');

const handlers = sandbox.belle_export_getHandlersByRegistry_({});
const handlerKeys = Object.keys(handlers);
expect(handlerKeys[0] === 'cc_statement', 'export handler order should start with cc_statement');
expect(handlerKeys[1] === 'receipt', 'export handler order should include receipt');

console.log('OK: test_doc_type_registry_callsite_smoke');




