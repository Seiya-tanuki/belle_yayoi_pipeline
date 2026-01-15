// @ts-check

// NOTE: Keep comments ASCII only.

function belle_yayoi_formatDate(dateStr) {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s.replace(/-/g, "/");
}

function belle_yayoi_isNumber(value) {
  const n = Number(value);
  if (!isFinite(n)) return null;
  return n;
}

function belle_yayoi_sumLineItemsByRate(parsed, rate) {
  if (!parsed || !Array.isArray(parsed.line_items)) return null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < parsed.line_items.length; i++) {
    const item = parsed.line_items[i];
    if (!item) continue;
    if (item.tax_rate !== rate) continue;
    const amt = belle_yayoi_isNumber(item.amount_jpy);
    if (amt === null) continue;
    sum += amt;
    count++;
  }
  return count > 0 ? sum : null;
}

function belle_yayoi_determineSingleRate(parsed) {
  const taxRatePrinted = parsed && parsed.tax_meta ? parsed.tax_meta.tax_rate_printed : null;
  if (taxRatePrinted === 8 || taxRatePrinted === 10) {
    return { rate: taxRatePrinted, reason: "TAX_RATE_PRINTED" };
  }

  if (!parsed || !Array.isArray(parsed.line_items)) {
    return { rate: null, reason: "NO_LINE_ITEMS" };
  }

  const rates = {};
  let knownCount = 0;
  let unknownCount = 0;
  for (let i = 0; i < parsed.line_items.length; i++) {
    const item = parsed.line_items[i];
    if (!item) continue;
    if (item.tax_rate === 8 || item.tax_rate === 10) {
      rates[item.tax_rate] = true;
      knownCount++;
    } else {
      unknownCount++;
    }
  }

  const keys = Object.keys(rates);
  if (keys.length === 1) {
    return { rate: Number(keys[0]), reason: "LINE_ITEMS_SINGLE_RATE" };
  }
  if (knownCount === 0) {
    return { rate: null, reason: "NO_RATE_IN_TAX_META_OR_LINE_ITEMS" };
  }
  if (unknownCount > 0) {
    return { rate: null, reason: "MIXED_OR_UNKNOWN_LINE_ITEM_RATES" };
  }
  return { rate: null, reason: "MIXED_LINE_ITEM_RATES" };
}

function belle_yayoi_getGrossForRate(parsed, rate, isSingleRate, taxInOut) {
  const tb = parsed && parsed.tax_breakdown;
  const bucket = tb && (rate === 10 ? tb.rate_10 : tb.rate_8);

  if (isSingleRate) {
    const total = belle_yayoi_isNumber(parsed.receipt_total_jpy);
    if (total !== null) return { gross: total, reason: "RECEIPT_TOTAL" };
    const sum = belle_yayoi_sumLineItemsByRate(parsed, rate);
    if (sum !== null) return { gross: sum, reason: "LINE_ITEMS_SUM" };
    return { gross: null, reason: "NO_GROSS_SINGLE_RATE" };
  }

  const gross = bucket ? belle_yayoi_isNumber(bucket.gross_amount_jpy) : null;
  if (gross !== null) return { gross: gross, reason: "BUCKET_GROSS" };

  const taxable = bucket ? belle_yayoi_isNumber(bucket.taxable_amount_jpy) : null;
  const tax = bucket ? belle_yayoi_isNumber(bucket.tax_jpy) : null;

  if (taxInOut === "inclusive") {
    if (taxable !== null) return { gross: taxable, reason: "INCLUSIVE_TAXABLE_AS_GROSS" };
  }
  if (taxInOut === "exclusive") {
    if (taxable !== null && tax !== null) return { gross: taxable + tax, reason: "EXCLUSIVE_TAXABLE_PLUS_TAX" };
  }

  const sum = belle_yayoi_sumLineItemsByRate(parsed, rate);
  if (sum !== null) return { gross: sum, reason: "LINE_ITEMS_SUM" };

  return { gross: null, reason: "NO_GROSS_MULTI_RATE" };
}

function belle_yayoi_getDebitTaxKubun(rate, dateStr) {
  if (rate === 10) return "課対仕入込10%";
  if (rate === 8) {
    const d = belle_yayoi_formatDate(dateStr);
    if (!d) return "課対仕入込軽減8%";
    return d >= "2019/10/01" ? "課対仕入込軽減8%" : "課対仕入込8%";
  }
  return "";
}

function belle_yayoi_csvEscape(value) {
  if (value === null || value === undefined) return "\"\"";
  const s = String(value);
  return "\"" + s.replace(/\"/g, "\"\"") + "\"";
}

function belle_yayoi_buildCsvRow(cols) {
  return cols.map(belle_yayoi_csvEscape).join(",");
}

function belle_yayoi_buildRow(params) {
  return [
    "2000", // 1
    "", // 2
    "", // 3
    params.date, // 4
    "仮払金", // 5
    "", // 6
    "", // 7
    params.debitTaxKubun, // 8
    params.gross, // 9
    "", // 10
    "現金", // 11
    "", // 12
    "", // 13
    "対象外", // 14
    params.gross, // 15
    "", // 16
    params.summary, // 17
    "", // 18
    "", // 19
    "0", // 20
    "", // 21
    params.memo, // 22
    "", // 23
    "", // 24
    "NO" // 25
  ];
}

function belle_yayoi_getInvoiceSuffix(parsed, mode) {
  if (mode !== "AUTO") return "";
  const qi = parsed && parsed.qualified_invoice;
  if (qi && qi.registration_number) return "適格";
  const dateStr = parsed && parsed.transaction_date ? String(parsed.transaction_date) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  if (dateStr >= "2023-10-01" && dateStr <= "2026-09-30") return "区分80%";
  if (dateStr >= "2026-10-01" && dateStr <= "2029-09-30") return "区分50%";
  if (dateStr >= "2029-10-01") return "控不";
  return "";
}
