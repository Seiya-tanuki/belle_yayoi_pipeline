// @ts-check

/**
 * 開発環境疎通用: Script Properties の読み書き・ログ確認
 * 本番データは触らない。
 */
function belle_healthCheck() {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys();
  Logger.log({ ok: true, propertyKeys: keys, now: new Date().toISOString() });
  return { ok: true, propertyKeys: keys, now: new Date().toISOString() };
}

/**
 * 初期設定（手動で ID を差し替えて実行する想定）
 * NOTE: 値はログに出さない（秘匿）。
 */
function belle_setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  // TODO: 実運用の値を入れる（空のままコミットしない）
  // props.setProperties({
  //   BELLE_SHEET_ID: "",
  //   BELLE_DRIVE_FOLDER_ID: ""
  // }, true);
  Logger.log("belle_setupScriptProperties: done");
}

/**
 * Append-only: 指定シートに1行追記する。上書き・削除は禁止。
 * - BELLE_SHEET_ID / BELLE_SHEET_NAME を Script Properties から読む
 * - 失敗時は例外を投げる（呼び出し側で FAIL/WARN 運用）
 */
function belle_appendRow(values) {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("BELLE_SHEET_ID");
  var sheetName = props.getProperty("BELLE_SHEET_NAME") || "OCR_RAW";
  if (!sheetId) throw new Error("Missing Script Property: BELLE_SHEET_ID");
  if (!Array.isArray(values)) throw new Error("values must be an array");
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);
  sh.appendRow(values);
}
