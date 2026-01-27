// @ts-check

// NOTE: Keep comments ASCII only.

var BELLE_DOC_TYPE_RECEIPT = "receipt";
var BELLE_DOC_TYPE_CC_STATEMENT = "cc_statement";
var BELLE_DOC_TYPE_BANK_STATEMENT = "bank_statement";
var BELLE_DOC_PIPELINE_SINGLE_STAGE = "single_stage";
var BELLE_DOC_PIPELINE_TWO_STAGE = "two_stage";
var BELLE_DOC_PIPELINE_INACTIVE = "inactive";

function belle_docType_getSupportedDocTypes_() {
  return [BELLE_DOC_TYPE_RECEIPT, BELLE_DOC_TYPE_CC_STATEMENT, BELLE_DOC_TYPE_BANK_STATEMENT];
}

function belle_docType_assertSupportedDocType_(docType) {
  var spec = belle_docType_getSpec_(docType);
  if (!spec) throw new Error("UNSUPPORTED_DOC_TYPE: " + String(docType || ""));
  return spec;
}

function belle_docType_getSpec_(docType) {
  var key = String(docType || "");
  if (key === BELLE_DOC_TYPE_RECEIPT) return belle_docType_buildReceiptSpec_();
  if (key === BELLE_DOC_TYPE_CC_STATEMENT) return belle_docType_buildCcSpec_();
  if (key === BELLE_DOC_TYPE_BANK_STATEMENT) return belle_docType_buildBankSpec_();
  return null;
}

function belle_docType_getSpecBySubfolder_(name) {
  var key = String(name || "");
  var docTypes = belle_docType_getSupportedDocTypes_();
  for (var i = 0; i < docTypes.length; i++) {
    var spec = belle_docType_getSpec_(docTypes[i]);
    if (spec && spec.source_subfolder_name === key) return spec;
  }
  return null;
}

function belle_docType_buildReceiptSpec_() {
  return {
    doc_type: BELLE_DOC_TYPE_RECEIPT,
    source_subfolder_name: "receipt",
    queue_sheet_name: "OCR_RECEIPT",
    queue_sheet_name_getter: function (props) {
      return belle_cfg_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_RECEIPT);
    },
    ocr_sheet_name_default: "OCR_RECEIPT",
    ocr_sheet_name_getter: function (props) {
      return belle_cfg_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_RECEIPT);
    },
    pipeline_kind: BELLE_DOC_PIPELINE_SINGLE_STAGE,
    stage1_prompt_getter: null,
    stage2_prompt_getter: null,
    export_subfolder_name: "receipt",
    export_handler_key: BELLE_DOC_TYPE_RECEIPT,
    allow_pdf: false,
    stop_after_item: false,
    export_order: 2
  };
}

function belle_docType_buildCcSpec_() {
  return {
    doc_type: BELLE_DOC_TYPE_CC_STATEMENT,
    source_subfolder_name: "cc_statement",
    queue_sheet_name: "OCR_CC",
    queue_sheet_name_getter: function (props) {
      return belle_cfg_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_CC_STATEMENT);
    },
    ocr_sheet_name_default: "OCR_CC",
    ocr_sheet_name_getter: function (props) {
      return belle_cfg_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_CC_STATEMENT);
    },
    pipeline_kind: BELLE_DOC_PIPELINE_TWO_STAGE,
    stage1_prompt_getter: function () {
      return belle_ocr_getCcStage1Prompt_();
    },
    stage2_prompt_getter: function () {
      return belle_ocr_getCcStage2Prompt_();
    },
    export_subfolder_name: "cc_statement",
    export_handler_key: BELLE_DOC_TYPE_CC_STATEMENT,
    allow_pdf: true,
    stop_after_item: true,
    export_order: 1
  };
}

function belle_docType_buildBankSpec_() {
  return {
    doc_type: BELLE_DOC_TYPE_BANK_STATEMENT,
    source_subfolder_name: "bank_statement",
    queue_sheet_name: "OCR_BANK",
    queue_sheet_name_getter: function (props) {
      return belle_cfg_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_BANK_STATEMENT);
    },
    ocr_sheet_name_default: "OCR_BANK",
    ocr_sheet_name_getter: function (props) {
      return belle_cfg_getQueueSheetNameForDocType_(props, BELLE_DOC_TYPE_BANK_STATEMENT);
    },
    pipeline_kind: BELLE_DOC_PIPELINE_SINGLE_STAGE,
    stage1_prompt_getter: null,
    stage2_prompt_getter: function () {
      return belle_ocr_getBankStatementPrompt_v0_();
    },
    export_subfolder_name: "bank_statement",
    export_handler_key: BELLE_DOC_TYPE_BANK_STATEMENT,
    allow_pdf: true,
    stop_after_item: true,
    export_order: 3
  };
}

function belle_getDocTypeDefs_() {
  var docTypes = belle_docType_getSupportedDocTypes_();
  var out = [];
  for (var i = 0; i < docTypes.length; i++) {
    var spec = belle_docType_getSpec_(docTypes[i]);
    if (!spec) continue;
    out.push({
      docType: spec.doc_type,
      subfolder: spec.source_subfolder_name,
      sheetName: spec.ocr_sheet_name_default
    });
  }
  return out;
}

function belle_ocr_getDocTypeDefByDocType_(docType) {
  var spec = belle_docType_getSpec_(docType);
  if (!spec) return null;
  return {
    docType: spec.doc_type,
    subfolder: spec.source_subfolder_name,
    sheetName: spec.ocr_sheet_name_default
  };
}

function belle_ocr_getDocTypeDefBySubfolder_(name) {
  var spec = belle_docType_getSpecBySubfolder_(name);
  if (!spec) return null;
  return {
    docType: spec.doc_type,
    subfolder: spec.source_subfolder_name,
    sheetName: spec.ocr_sheet_name_default
  };
}

function belle_ocr_getActiveDocTypes_(props) {
  var p = props || belle_cfg_getProps_();
  var raw = String(p.getProperty("BELLE_ACTIVE_DOC_TYPES") || "").trim();
  if (!raw) return [BELLE_DOC_TYPE_RECEIPT];
  var parts = raw.split(",");
  var out = [];
  var seen = {};
  for (var i = 0; i < parts.length; i++) {
    var item = String(parts[i] || "").trim();
    if (!item) continue;
    var spec = belle_docType_getSpec_(item);
    if (!spec) {
      belle_configWarnOnce("BELLE_ACTIVE_DOC_TYPES_UNKNOWN", "unknown=" + item);
      continue;
    }
    if (!seen[spec.doc_type]) {
      seen[spec.doc_type] = true;
      out.push(spec.doc_type);
    }
  }
  if (out.length === 0) return [BELLE_DOC_TYPE_RECEIPT];
  return out;
}

function belle_ocr_getFixedQueueSheetNameForDocType_(docType) {
  var spec = belle_docType_getSpec_(docType);
  return spec ? spec.ocr_sheet_name_default : "OCR_RECEIPT";
}

function belle_ocr_getQueueSheetNameForDocType_(props, docType) {
  return belle_cfg_getQueueSheetNameForDocType_(props, docType);
}

function belle_ocr_allowPdfForDocType_(docType) {
  var spec = belle_docType_getSpec_(docType);
  return !!(spec && spec.allow_pdf === true);
}

function belle_ocr_shouldStopAfterItem_(docType) {
  var spec = belle_docType_getSpec_(docType);
  return !!(spec && spec.stop_after_item === true);
}
