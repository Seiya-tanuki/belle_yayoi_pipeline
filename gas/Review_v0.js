// @ts-check

// NOTE: Keep comments ASCII only.

function belle_export_runDocTypes(handlers) {
  return belle_export_runDocTypesInternal_(handlers);
}

function belle_exportYayoiCsv(options) {
  return belle_exportYayoiCsvFallbackInternal_(options);
}

function belle_exportYayoiCsvReceipt(options) {
  return belle_exportYayoiCsvReceiptFallbackInternal_(options);
}

function belle_exportYayoiCsvCcStatement(options) {
  return belle_exportYayoiCsvCcStatementFallbackInternal_(options);
}
