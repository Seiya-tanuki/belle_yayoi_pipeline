const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js','utf8') + '\n' + fs.readFileSync('gas/Queue_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Export_v0.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const header = sandbox.belle_getQueueHeaderColumns_v0();
if (!Array.isArray(header)) throw new Error('header missing');
if (header[0] !== 'status' || header[1] !== 'file_id') throw new Error('header order wrong');
const exportHeader = sandbox.belle_getExportLogHeaderColumns_v0();
if (!Array.isArray(exportHeader) || exportHeader[0] !== 'file_id') throw new Error('export header wrong');
console.log('OK: test_reset_headers');





