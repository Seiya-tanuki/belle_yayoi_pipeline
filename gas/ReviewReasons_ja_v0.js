// @ts-check

// NOTE: Keep comments ASCII only.

function belle_reviewReasonJa(code, context) {
  const ctx = context || {};
  const fileName = ctx.file_name ? String(ctx.file_name) : "";
  const merchant = ctx.merchant ? String(ctx.merchant) : "";
  const detail = ctx.detail ? String(ctx.detail) : "";

  switch (code) {
    case "UNKNOWN_TAX_RATE":
    case "UNKNOWN_SINGLE_RATE":
      return [
        "税率（8%/10%）の印字が見つかりません。",
        "画像を確認し、tax_rate_bucket を 8 または 10 に設定してください。",
        "debit_tax_kubun_override に対応する税区分（例: 課対仕入込10% / 課対仕入込軽減8%）を入力してください。",
        fileName ? "対象: " + fileName : "",
        merchant ? "店舗: " + merchant : "",
        detail ? "補足: " + detail : ""
      ].filter(Boolean).join(" ");
    case "GROSS_UNKNOWN":
    case "AMOUNT_MISSING":
      return [
        "金額が判定できません。",
        "amount_gross_jpy を入力してください（必要なら税区分も確認）。",
        fileName ? "対象: " + fileName : "",
        merchant ? "店舗: " + merchant : "",
        detail ? "補足: " + detail : ""
      ].filter(Boolean).join(" ");
    case "TAX_BREAKDOWN_MISSING":
      return [
        "税内訳の情報が不足しています。",
        "tax_rate_bucket と amount_gross_jpy を確認・入力してください。",
        fileName ? "対象: " + fileName : "",
        merchant ? "店舗: " + merchant : ""
      ].filter(Boolean).join(" ");
    case "MISSING_DEBIT_TAX_KUBUN":
      return [
        "税区分が未設定です。",
        "debit_tax_kubun_override に適切な税区分を入力してください。",
        fileName ? "対象: " + fileName : "",
        merchant ? "店舗: " + merchant : ""
      ].filter(Boolean).join(" ");
    case "OCR_JSON_PARSE_ERROR":
      return [
        "OCR結果のJSONが壊れています。",
        "OCR再実行または手動修正を検討してください。",
        fileName ? "対象: " + fileName : ""
      ].filter(Boolean).join(" ");
    default:
      return [
        "要確認の項目です。",
        "必要に応じて tax_rate_bucket / amount_gross_jpy / debit_tax_kubun_override を入力してください。",
        fileName ? "対象: " + fileName : "",
        merchant ? "店舗: " + merchant : ""
      ].filter(Boolean).join(" ");
  }
}
