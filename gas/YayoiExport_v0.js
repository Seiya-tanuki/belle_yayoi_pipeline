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
