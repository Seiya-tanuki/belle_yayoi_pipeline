const fs = require('fs');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function collectFunctionNames(content) {
  const pattern = /function\s+([A-Za-z0-9_]+)\s*\(/g;
  const names = [];
  let m = null;
  while ((m = pattern.exec(content)) !== null) {
    names.push(m[1]);
  }
  return names;
}

const entrypointsContent = fs.readFileSync('gas/ExportEntrypoints.js', 'utf8');
const exportContent = fs.readFileSync('gas/Export.js', 'utf8');

const entrypointsDefs = collectFunctionNames(entrypointsContent).filter((n) => n.startsWith('belle_export'));
const entrypointsAllowed = [
  'belle_export_runDocTypes',
  'belle_exportYayoiCsv',
  'belle_exportYayoiCsvReceipt',
  'belle_exportYayoiCsvCcStatement',
  'belle_exportYayoiCsvBankStatement'
];

const unexpectedEntrypoints = entrypointsDefs.filter((n) => !entrypointsAllowed.includes(n));
expect(unexpectedEntrypoints.length === 0, 'unexpected export definitions in ExportEntrypoints.js: ' + JSON.stringify(unexpectedEntrypoints));

const exportDefs = collectFunctionNames(exportContent);
const requiredExport = [
  'belle_getOrCreateExportLogSheet',
  'belle_exportLog_buildSchemaMismatchDetail_',
  'belle_export_pickSingleFolder_',
  'belle_export_resolveOutputFolderByDocType_',
  'belle_export_runDocTypesInternal_',
  'belle_export_getHandlersByRegistry_',
  'belle_exportYayoiCsvInternal_',
  'belle_exportYayoiCsvReceiptInternal_',
  'belle_exportYayoiCsvCcStatementInternal_',
  'belle_exportYayoiCsvBankStatementInternal_',
  'belle_exportYayoiCsvInternalFromEntrypoints_'
];

const missing = requiredExport.filter((n) => !exportDefs.includes(n));
expect(missing.length === 0, 'missing export helpers in Export.js: ' + JSON.stringify(missing));

const wrapperOverlap = entrypointsAllowed.filter((n) => exportDefs.includes(n));
expect(wrapperOverlap.length === 0, 'wrapper names should not be defined in Export.js: ' + JSON.stringify(wrapperOverlap));

console.log('OK: test_export_module_boundaries');
