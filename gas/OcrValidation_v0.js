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
