// @ts-check

// NOTE: Keep comments ASCII only.

function belle_ocr_validateSchema(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, reason: "NOT_OBJECT" };
  const keys = Object.keys(obj);
  if (keys.length === 0) return { ok: false, reason: "EMPTY_RESPONSE" };
  if (!("receipt_total_jpy" in obj)) return { ok: false, reason: "MISSING_RECEIPT_TOTAL" };
  const total = obj.receipt_total_jpy;
  if (typeof total !== "number" || isNaN(total)) return { ok: false, reason: "INVALID_RECEIPT_TOTAL" };
  if (!("merchant" in obj)) return { ok: false, reason: "MISSING_MERCHANT" };
  const merchant = obj.merchant;
  if (!(typeof merchant === "string" || merchant === null)) return { ok: false, reason: "INVALID_MERCHANT" };
  return { ok: true, reason: "" };
}

function belle_ocr_validateCcStage1_(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, reason: "NOT_OBJECT" };
  if (obj.task !== "page_classification") return { ok: false, reason: "INVALID_TASK" };
  if (!("page_type" in obj)) return { ok: false, reason: "MISSING_PAGE_TYPE" };
  const pageType = obj.page_type;
  if (pageType !== "transactions" && pageType !== "non_transactions" && pageType !== "unknown") {
    return { ok: false, reason: "INVALID_PAGE_TYPE" };
  }
  if (!Array.isArray(obj.reason_codes)) return { ok: false, reason: "INVALID_REASON_CODES" };
  if (!Array.isArray(obj.page_issues)) return { ok: false, reason: "INVALID_PAGE_ISSUES" };
  return { ok: true, reason: "" };
}

function belle_ocr_validateCcStage2_(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, reason: "NOT_OBJECT" };
  if (obj.task !== "transaction_extraction") return { ok: false, reason: "INVALID_TASK" };
  if ("description" in obj) return { ok: false, reason: "UNEXPECTED_DESCRIPTION" };
  if (!Array.isArray(obj.transactions)) return { ok: false, reason: "INVALID_TRANSACTIONS" };
  for (let i = 0; i < obj.transactions.length; i++) {
    const row = obj.transactions[i];
    if (!row || typeof row !== "object") return { ok: false, reason: "INVALID_TRANSACTION_ROW" };
    if ("description" in row) return { ok: false, reason: "UNEXPECTED_DESCRIPTION" };
    if (typeof row.row_no !== "number" || isNaN(row.row_no)) return { ok: false, reason: "INVALID_ROW_NO" };
    if (typeof row.raw_use_date_text !== "string") return { ok: false, reason: "INVALID_RAW_USE_DATE_TEXT" };
    if (typeof row.use_month !== "number" || isNaN(row.use_month)) return { ok: false, reason: "INVALID_USE_MONTH" };
    if (typeof row.use_day !== "number" || isNaN(row.use_day)) return { ok: false, reason: "INVALID_USE_DAY" };
    if (typeof row.merchant !== "string") return { ok: false, reason: "INVALID_MERCHANT" };
    if (typeof row.amount_yen !== "number" || isNaN(row.amount_yen)) return { ok: false, reason: "INVALID_AMOUNT_YEN" };
    if (row.amount_sign !== "debit" && row.amount_sign !== "credit") return { ok: false, reason: "INVALID_AMOUNT_SIGN" };
    if (!Array.isArray(row.issues)) return { ok: false, reason: "INVALID_ISSUES" };
    for (let j = 0; j < row.issues.length; j++) {
      if (typeof row.issues[j] !== "string") return { ok: false, reason: "INVALID_ISSUES" };
    }
  }
  return { ok: true, reason: "" };
}
