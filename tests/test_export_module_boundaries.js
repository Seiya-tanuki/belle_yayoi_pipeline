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

const reviewContent = fs.readFileSync('gas/Review.js', 'utf8');
const exportContent = fs.readFileSync('gas/Export.js', 'utf8');

const reviewDefs = collectFunctionNames(reviewContent).filter((n) => n.startsWith('belle_export'));
const reviewAllowed = [
  'belle_export_runDocTypes',
  'belle_exportYayoiCsv',
  'belle_exportYayoiCsvReceipt',
  'belle_exportYayoiCsvCcStatement',
  'belle_exportYayoiCsvBankStatement'
];

const unexpectedReview = reviewDefs.filter((n) => !reviewAllowed.includes(n));
expect(unexpectedReview.length === 0, 'unexpected export definitions in Review.js: ' + JSON.stringify(unexpectedReview));

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
  'belle_exportYayoiCsvInternalFromReview_'
];

const missing = requiredExport.filter((n) => !exportDefs.includes(n));
expect(missing.length === 0, 'missing export helpers in Export.js: ' + JSON.stringify(missing));

const wrapperOverlap = reviewAllowed.filter((n) => exportDefs.includes(n));
expect(wrapperOverlap.length === 0, 'wrapper names should not be defined in Export.js: ' + JSON.stringify(wrapperOverlap));

console.log('OK: test_export_module_boundaries');
