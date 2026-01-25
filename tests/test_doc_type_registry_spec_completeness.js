const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const requiredKeys = [
  'doc_type',
  'source_subfolder_name',
  'queue_sheet_name',
  'export_subfolder_name',
  'pipeline_kind',
  'export_handler_key',
  'allow_pdf',
  'stop_after_item'
];

const pipelineAllow = ['single_stage', 'two_stage', 'inactive'];
const exportHandlerAllow = ['receipt', 'cc_statement', '', 'bank_inactive'];

const supported = sandbox.belle_docType_getSupportedDocTypes_();
expect(Array.isArray(supported) && supported.length > 0, 'supported doc types missing');

for (const docType of supported) {
  const spec = sandbox.belle_docType_getSpec_(docType);
  expect(spec && typeof spec === 'object', 'spec missing for ' + docType);
  for (const key of requiredKeys) {
    expect(Object.prototype.hasOwnProperty.call(spec, key), 'missing key ' + key + ' for ' + docType);
  }
  expect(typeof spec.doc_type === 'string', 'doc_type not string for ' + docType);
  expect(typeof spec.source_subfolder_name === 'string', 'source_subfolder_name not string for ' + docType);
  expect(typeof spec.queue_sheet_name === 'string', 'queue_sheet_name not string for ' + docType);
  expect(typeof spec.export_subfolder_name === 'string', 'export_subfolder_name not string for ' + docType);
  expect(pipelineAllow.indexOf(spec.pipeline_kind) >= 0, 'pipeline_kind not allowed for ' + docType);
  expect(exportHandlerAllow.indexOf(spec.export_handler_key) >= 0, 'export_handler_key not allowed for ' + docType);
  expect(typeof spec.allow_pdf === 'boolean', 'allow_pdf not boolean for ' + docType);
  expect(typeof spec.stop_after_item === 'boolean', 'stop_after_item not boolean for ' + docType);
  expect(typeof spec.queue_sheet_name_getter === 'function', 'queue_sheet_name_getter missing for ' + docType);
  const defaultSheet = spec.queue_sheet_name_getter({ getProperty: () => '' });
  expect(defaultSheet === spec.queue_sheet_name, 'queue_sheet_name getter default mismatch for ' + docType);
}

console.log('OK: test_doc_type_registry_spec_completeness');