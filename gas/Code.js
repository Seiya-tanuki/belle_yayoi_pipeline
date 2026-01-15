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
