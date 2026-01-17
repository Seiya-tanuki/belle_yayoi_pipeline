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

function belle_yayoi_hasIssue(parsed, code) {
  if (!parsed || !Array.isArray(parsed.overall_issues)) return false;
  for (let i = 0; i < parsed.overall_issues.length; i++) {
    const it = parsed.overall_issues[i];
    if (it && it.code === code) return true;
  }
  return false;
}

function belle_yayoi_hasAnyIssues(parsed) {
  return !!(parsed && Array.isArray(parsed.overall_issues) && parsed.overall_issues.length > 0);
}

function belle_yayoi_isQualifiedInvoice(parsed) {
  const qi = parsed && parsed.qualified_invoice;
  if (!qi || !qi.registration_number) return false;
  const confidence = Number(qi.confidence || 0);
  const issues = Array.isArray(qi.issues) ? qi.issues : [];
  return confidence >= 0.9 && issues.length === 0;
}

function belle_yayoi_getRegistrationNumber(parsed) {
  const qi = parsed && parsed.qualified_invoice;
  if (qi && qi.registration_number) return String(qi.registration_number);
  return "";
}

function belle_yayoi_shiftJisBytes(str) {
  try {
    return (/** @type {any} */ (Utilities.newBlob(str))).getBytes("Shift_JIS").length;
  } catch (e) {
    return Utilities.newBlob(str).getBytes().length;
  }
}

function belle_yayoi_trimShiftJis(str, maxBytes) {
  if (belle_yayoi_shiftJisBytes(str) <= maxBytes) return str;
  let out = str;
  while (out.length > 0 && belle_yayoi_shiftJisBytes(out) > maxBytes) {
    out = out.slice(0, -1);
  }
  return out;
}

function belle_yayoi_trimTextShiftJis(text, maxBytes) {
  if (!text) return "";
  return belle_yayoi_trimShiftJis(String(text), maxBytes);
}

function belle_yayoi_isValidDateParts(year, month, day) {
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function belle_yayoi_parseYmd(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
  const parts = String(dateStr).split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!belle_yayoi_isValidDateParts(y, m, d)) return null;
  return { y: y, m: m, d: d, ymd: parts[0] + "-" + parts[1] + "-" + parts[2] };
}

function belle_yayoi_validateFiscalRange(startStr, endStr) {
  const start = belle_yayoi_parseYmd(startStr);
  const end = belle_yayoi_parseYmd(endStr);
  if (!start || !end) return { ok: false, reason: "FISCAL_RANGE_NOT_CONFIGURED" };
  if (start.y !== end.y) return { ok: false, reason: "FISCAL_YEAR_MISMATCH" };
  if (start.ymd > end.ymd) return { ok: false, reason: "FISCAL_RANGE_NOT_CONFIGURED" };
  return { ok: true, reason: "", start: start, end: end };
}

function belle_yayoi_resolveTransactionDate(parsed, fiscal) {
  const result = { dateYmdSlash: "", dateFix: "", dateRid: "", dateDt: "", original: "" };
  const fiscalEnd = fiscal.end.ymd;
  const fiscalStart = fiscal.start.ymd;
  const parsedDate = parsed && parsed.transaction_date ? String(parsed.transaction_date) : "";
  const parsedParts = belle_yayoi_parseYmd(parsedDate);
  if (!parsedParts) {
    result.dateYmdSlash = belle_yayoi_formatDate(fiscalEnd);
    result.dateFix = "誤った取引日";
    result.dateRid = "DATE_FALLBACK";
    result.dateDt = "NO_DATE";
    return result;
  }

  result.original = parsedParts.ymd;
  if (parsedParts.ymd < fiscalStart || parsedParts.ymd > fiscalEnd) {
    const y = fiscal.start.y;
    const mm = String(parsedParts.m).padStart(2, "0");
    const dd = String(parsedParts.d).padStart(2, "0");
    const replaced = y + "-" + mm + "-" + dd;
    const replacedParts = belle_yayoi_parseYmd(replaced);
    if (!replacedParts) {
      result.dateYmdSlash = belle_yayoi_formatDate(fiscalEnd);
      result.dateFix = "誤った取引日";
      result.dateRid = "DATE_FALLBACK";
      result.dateDt = "LEAP_ADJUST";
      return result;
    }
    result.dateYmdSlash = belle_yayoi_formatDate(replacedParts.ymd);
    result.dateFix = "誤った取引日";
    result.dateRid = "DATE_FALLBACK";
    result.dateDt = "OUT_OF_RANGE";
    return result;
  }

  result.dateYmdSlash = belle_yayoi_formatDate(parsedParts.ymd);
  return result;
}

function belle_yayoi_sanitizeFileName(input) {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/\|/g, "_");
  s = s.replace(/[\r\n]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function belle_yayoi_normalizeDigits(input) {
  if (!input) return "";
  const map = {
    "０": "0",
    "１": "1",
    "２": "2",
    "３": "3",
    "４": "4",
    "５": "5",
    "６": "6",
    "７": "7",
    "８": "8",
    "９": "9"
  };
  let out = String(input);
  for (const k in map) {
    out = out.split(k).join(map[k]);
  }
  return out;
}

function belle_yayoi_extractTaxFromDescription(desc) {
  if (!desc) return null;
  const s = belle_yayoi_normalizeDigits(String(desc));
  const re = /(内消費税等|内消費税|うち消費税|消費税等)[^0-9]*([0-9]{1,6})/;
  const m = s.match(re);
  if (!m) return null;
  const n = Number(m[2]);
  return isFinite(n) ? n : null;
}

function belle_yayoi_sumTaxFromLineItems(parsed) {
  if (!parsed || !Array.isArray(parsed.line_items)) return null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < parsed.line_items.length; i++) {
    const item = parsed.line_items[i];
    if (!item) continue;
    let tax = belle_yayoi_isNumber(item.tax_jpy);
    if (tax === null) {
      tax = belle_yayoi_extractTaxFromDescription(item.description);
    }
    if (tax === null) continue;
    sum += tax;
    count++;
  }
  return count > 0 ? sum : null;
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

function belle_yayoi_inferRateByTaxTotal(gross, tax, tolerance) {
  const rates = [8, 10];
  const matches = [];
  for (let i = 0; i < rates.length; i++) {
    const r = rates[i];
    const expected = gross * r / (100 + r);
    const rounded = Math.round(expected);
    const floored = Math.floor(expected);
    if (Math.abs(rounded - tax) <= tolerance || Math.abs(floored - tax) <= tolerance) {
      matches.push(r);
    }
  }
  if (matches.length === 1) return { rate: matches[0], reason: "TAX_TOTAL_MATCH" };
  if (matches.length > 1) return { rate: null, reason: "MULTI_RATE" };
  return { rate: null, reason: "TAX_TOTAL_NO_MATCH" };
}

function belle_yayoi_inferRateFromLineItems(parsed, tolerance) {
  if (!parsed || !Array.isArray(parsed.line_items)) return { rate: null, reason: "NO_LINE_ITEMS" };
  const ratesFound = {};
  for (let i = 0; i < parsed.line_items.length; i++) {
    const item = parsed.line_items[i];
    if (!item || !item.description) continue;
    const desc = String(item.description);
    if (!/内消費税|内消費税等|うち消費税|消費税等/.test(desc)) continue;

    const amount = belle_yayoi_isNumber(item.amount_jpy);
    let tax = belle_yayoi_isNumber(item.tax_jpy);
    if (tax === null) tax = belle_yayoi_extractTaxFromDescription(desc);
    if (tax === null) continue;

    if (amount !== null) {
      const gross = amount + tax;
      const byTax = belle_yayoi_inferRateByTaxTotal(gross, tax, tolerance);
      if (byTax.rate === 8 || byTax.rate === 10) {
        ratesFound[byTax.rate] = true;
      } else if (byTax.reason === "MULTI_RATE") {
        ratesFound[8] = true;
        ratesFound[10] = true;
      }
    }
  }
  const keys = Object.keys(ratesFound);
  if (keys.length === 1) return { rate: Number(keys[0]), reason: "LINE_ITEM_TAX_MATCH" };
  if (keys.length > 1) return { rate: null, reason: "MULTI_RATE" };
  return { rate: null, reason: "NO_LINE_ITEM_TAX_MATCH" };
}

function belle_yayoi_determineSingleRate(parsed) {
  const tolerance = 1; // Allow 1 yen rounding difference.
  const taxRatePrinted = parsed && parsed.tax_meta ? parsed.tax_meta.tax_rate_printed : null;
  if (taxRatePrinted === 8 || taxRatePrinted === 10) {
    return { rate: taxRatePrinted, inferred: false, reason: "TAX_RATE_PRINTED", method: "PRINTED" };
  }

  const grossTotal = belle_yayoi_isNumber(parsed && parsed.receipt_total_jpy);
  let taxTotal = belle_yayoi_isNumber(parsed && parsed.tax_total_jpy);
  let taxSource = "REVERSE_TOTAL";
  if (taxTotal === null) {
    taxTotal = belle_yayoi_sumTaxFromLineItems(parsed);
    if (taxTotal !== null) taxSource = "LINEITEM_TAX";
  }
  if (taxTotal !== null && grossTotal !== null && grossTotal > 0) {
    const byTotal = belle_yayoi_inferRateByTaxTotal(grossTotal, taxTotal, tolerance);
    if (byTotal.reason === "MULTI_RATE") return { rate: null, inferred: true, reason: "MULTI_RATE", method: taxSource };
    if (byTotal.rate === 8 || byTotal.rate === 10) {
      return { rate: byTotal.rate, inferred: true, reason: "TAX_TOTAL_MATCH", method: taxSource };
    }
  }

  const byItems = belle_yayoi_inferRateFromLineItems(parsed, tolerance);
  if (byItems.reason === "MULTI_RATE") return { rate: null, inferred: true, reason: "MULTI_RATE", method: "LINEITEM_TAX" };
  if (byItems.rate === 8 || byItems.rate === 10) {
    return { rate: byItems.rate, inferred: true, reason: "LINE_ITEM_TAX_MATCH", method: "LINEITEM_TAX" };
  }

  return { rate: null, inferred: false, reason: "TAX_UNKNOWN", method: "UNKNOWN" };
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

function belle_yayoi_getDebitTaxKubunFallback(rate, dateStr, parsed, appendSuffix) {
  if (rate !== 8 && rate !== 10) return "";
  const base = belle_yayoi_getDebitTaxKubun(rate, dateStr);
  if (!base) return "";
  if (appendSuffix && belle_yayoi_isQualifiedInvoice(parsed)) return base + "適格";
  return base;
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


function belle_yayoi_trimTekyoPreserveRegNo(merchant, regNo, maxBytes) {
  const safeMerchant = merchant ? String(merchant) : "";
  const safeReg = regNo ? String(regNo) : "";
  if (!safeReg) return belle_yayoi_trimTextShiftJis(safeMerchant, maxBytes);

  const sep = " / ";
  const regPart = sep + safeReg;
  const full = safeMerchant + regPart;
  if (belle_yayoi_shiftJisBytes(full) <= maxBytes) return full;

  const regBytes = belle_yayoi_shiftJisBytes(regPart);
  const allowedMerchantBytes = maxBytes - regBytes;
  if (allowedMerchantBytes <= 0) return safeReg;

  const trimmedMerchant = belle_yayoi_trimShiftJis(safeMerchant, allowedMerchantBytes);
  if (!trimmedMerchant) return safeReg;
  return trimmedMerchant + regPart;
}

function belle_yayoi_buildSummary(parsed) {
  const merchant = parsed && parsed.merchant ? String(parsed.merchant) : "BELLE";
  const reg = belle_yayoi_getRegistrationNumber(parsed);
  if (reg) return belle_yayoi_trimTekyoPreserveRegNo(merchant, reg, 120);
  return belle_yayoi_trimTextShiftJis(merchant, 120);
}

function belle_yayoi_buildFallbackFixText(reasonCodes) {
  const codes = String(reasonCodes || "").split(";").filter(Boolean);
  if (codes.indexOf("UNUSUAL_FORMAT") >= 0) return "明細合計不一致";
  if (codes.indexOf("MULTI_RATE") >= 0) return "税率混在の可能性";
  if (codes.indexOf("TAX_UNKNOWN") >= 0) return "税率/税区分要確認";
  if (codes.indexOf("OCR_JSON_PARSE_ERROR") >= 0) return "OCR結果要確認";
  if (codes.indexOf("OCR_ERROR_FINAL") >= 0) return "OCRエラー要確認";
  if (codes.indexOf("AMOUNT_FALLBACK") >= 0) return "金額要確認";
  if (codes.indexOf("DATE_FALLBACK") >= 0) return "日付要確認";
  return "";
}

function belle_yayoi_buildFallbackMemo(params) {
  const reasonCode = params.reasonCode || "UNKNOWN";
  const fileId = params.fileId || "";
  const fileNameRaw = params.fileName || "";
  const fileName = belle_yayoi_sanitizeFileName(fileNameRaw);
  const fix = params.fix || "";
  const err = params.err || "";
  const errPart = err ? "|ERR=" + err : "";
  const dtPart = params.dtCode ? "|DT=" + params.dtCode : "";
  const fnPart = fileName ? "|FN=" + fileName : "";
  const fidPart = "|FID=" + fileId;
  const fixPart = fix ? "FIX=" + fix + "|" : "";
  const core = "BELLE|FBK=1|RID=" + reasonCode + dtPart;

  let memo = fixPart + core + fnPart + errPart + fidPart;
  if (belle_yayoi_shiftJisBytes(memo) <= 180) return memo;

  memo = fixPart + core + fnPart + fidPart;
  if (belle_yayoi_shiftJisBytes(memo) <= 180) return memo;

  memo = fixPart + core + fidPart;
  if (belle_yayoi_shiftJisBytes(memo) <= 180) return memo;

  const fidShort = fileId ? "|FID=" + String(fileId).slice(0, 8) : "|FID=";
  memo = fixPart + core + fidShort;
  if (belle_yayoi_shiftJisBytes(memo) <= 180) return memo;

  if (fixPart) {
    const maxFixBytes = 180 - belle_yayoi_shiftJisBytes(core + fidShort);
    if (maxFixBytes > 0) {
      const trimmedFix = belle_yayoi_trimShiftJis(fix, maxFixBytes);
      memo = "FIX=" + trimmedFix + "|" + core + fidShort;
      if (belle_yayoi_shiftJisBytes(memo) <= 180) return memo;
    }
  }

  memo = core + fidShort + errPart;
  if (belle_yayoi_shiftJisBytes(memo) <= 180) return memo;

  return belle_yayoi_trimShiftJis(memo, 180);
}

function belle_yayoi_pickRidAndFix(parsed, rateInfo) {
  const BENIGN_OVERALL_ISSUE_CODES = new Set(["MISSING_TAX_INFO"]);
  if (parsed && belle_yayoi_hasIssue(parsed, "UNUSUAL_FORMAT")) {
    return { rid: "UNUSUAL_FORMAT", fix: "明細合計不一致" };
  }
  if (rateInfo && rateInfo.reason === "MULTI_RATE") {
    return { rid: "MULTI_RATE", fix: "税率混在の可能性" };
  }
  if (!rateInfo || rateInfo.rate === null) {
    return { rid: "TAX_UNKNOWN", fix: "税率/税区分要確認" };
  }
  if (parsed && Array.isArray(parsed.overall_issues) && parsed.overall_issues.length > 0) {
    const codes = parsed.overall_issues.map((it) => (it && it.code ? String(it.code) : "")).filter(Boolean);
    const nonBenignCodes = codes.filter((c) => !BENIGN_OVERALL_ISSUE_CODES.has(c));
    if (nonBenignCodes.length > 0) {
      return { rid: "OCR_ISSUES", fix: "OCRに問題あり" };
    }
  }
  if (rateInfo.inferred) {
    return { rid: "TAX_INFERRED", fix: "" };
  }
  return { rid: "OK", fix: "" };
}
