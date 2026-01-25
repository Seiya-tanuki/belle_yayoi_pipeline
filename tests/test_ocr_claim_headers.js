const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const header = sandbox.belle_getQueueHeader_fallback_v0_();
expect(Array.isArray(header), 'header should be array');
expect(header.indexOf('doc_type') >= 0, 'missing doc_type');
expect(header.indexOf('source_subfolder') >= 0, 'missing source_subfolder');
expect(header.indexOf('ocr_lock_owner') >= 0, 'missing ocr_lock_owner');
expect(header.indexOf('ocr_lock_until_iso') >= 0, 'missing ocr_lock_until_iso');
expect(header.indexOf('ocr_processing_started_at_iso') >= 0, 'missing ocr_processing_started_at_iso');

const unique = new Set(header);
expect(unique.size === header.length, 'header should not contain duplicates');

console.log('OK: test_ocr_claim_headers');


