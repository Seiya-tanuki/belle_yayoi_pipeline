# PROJECT_STATE_SNAPSHOT

## 1. 概要（パイプライン段階）
- list: belle_listFilesInFolder (gas/Code.js)
- queue: belle_queueFolderFilesToSheet (gas/Code.js)
- ocr: belle_processQueueOnce (gas/Code.js)
- review: belle_buildReviewFromDoneQueue (gas/Review_v0.js)
- export: belle_exportYayoiCsvFromReview (gas/Review_v0.js)

## 2. シート一覧（コード上の正式名と用途）
- OCR_RAW: belle_appendRow の既定シート名（gas/Code.js:36）
- QUEUEシート: BELLE_QUEUE_SHEET_NAME または BELLE_SHEET_NAME を参照（gas/Code.js:111-115）
- REVIEW_STATE: 既定名 "REVIEW_STATE"（gas/Review_v0.js:267）
- REVIEW_UI: 既定名 "REVIEW_UI"（gas/Review_v0.js:268）
- REVIEW_LOG: 既定名 "REVIEW_LOG"（gas/Review_v0.js:269）
- IMPORT_LOG: 既定名 "IMPORT_LOG"（gas/Review_v0.js:452, gas/Code.js:427）
- EXPORT_SKIP_LOG: 既定名 "EXPORT_SKIP_LOG"（gas/Code.js:428）

## 3. 各シートのヘッダ
### REVIEW_STATE（gas/Review_v0.js:5）
- review_key
- source_file_id
- source_file_name
- drive_url
- transaction_date
- merchant
- receipt_total_jpy
- tax_rate_bucket_auto
- tax_rate_bucket_override
- debit_tax_kubun_auto
- debit_tax_kubun_override
- memo_auto
- memo_override
- review_status
- review_reason_code
- review_reason
- export_status
- exported_at_iso
- export_csv_file_id
- amount_gross_jpy
### REVIEW_UI（gas/Review_v0.js:30）
- review_status
- review_reason
- source_file_name
- drive_url
- transaction_date
- merchant
- receipt_total_jpy
- tax_rate_bucket_override
- debit_tax_kubun_override
- memo_override
- review_key
### REVIEW_LOG（gas/Review_v0.js:49）
- review_key
- source_file_id
- tax_rate_bucket
- created_at_iso
### QUEUE（チェック対象ヘッダ、gas/Code.js:124,286,444 / gas/Review_v0.js:285）
- status
- file_id
- file_name
- mime_type
- drive_url
- queued_at_iso
- ocr_json
- ocr_error
### IMPORT_LOG（作成時ヘッダ、gas/Review_v0.js:556）
- file_id
- exported_at_iso
- csv_file_id
### EXPORT_SKIP_LOG（gas/Code.js:392）
- exported_at_iso
- file_id
- file_name
- reason

## 4. 実行エントリポイント関数一覧（belle_*）
```text
gas\YayoiExport_v0.js:5:function belle_yayoi_formatDate(dateStr) {
gas\YayoiExport_v0.js:12:function belle_yayoi_isNumber(value) {
gas\YayoiExport_v0.js:18:function belle_yayoi_sumLineItemsByRate(parsed, rate) {
gas\YayoiExport_v0.js:34:function belle_yayoi_determineSingleRate(parsed) {
gas\YayoiExport_v0.js:71:function belle_yayoi_getGrossForRate(parsed, rate, isSingleRate, taxInOut) {
gas\YayoiExport_v0.js:102:function belle_yayoi_getDebitTaxKubun(rate, dateStr) {
gas\YayoiExport_v0.js:112:function belle_yayoi_csvEscape(value) {
gas\YayoiExport_v0.js:118:function belle_yayoi_buildCsvRow(cols) {
gas\YayoiExport_v0.js:122:function belle_yayoi_buildRow(params) {
gas\YayoiExport_v0.js:152:function belle_yayoi_getInvoiceSuffix(parsed, mode) {
gas\Review_v0.js:5:function belle_review_state_header() {
gas\Review_v0.js:30:function belle_review_ui_header() {
gas\Review_v0.js:49:function belle_review_log_header() {
gas\Review_v0.js:53:function belle_review_getHeaderRow(sh) {
gas\Review_v0.js:57:function belle_review_getHeaderMap(headerRow) {
gas\Review_v0.js:65:function belle_review_getOrCreateSheet(ss, name, header) {
gas\Review_v0.js:84:function belle_review_makeKey(fileId, bucket) {
gas\Review_v0.js:88:function belle_review_loadLogSet(logSheet) {
gas\Review_v0.js:100:function belle_review_hasRate(parsed, rate) {
gas\Review_v0.js:119:function belle_review_effectiveBucket(autoBucket, overrideBucket) {
gas\Review_v0.js:125:function belle_review_effectiveDebit(autoKubun, overrideKubun) {
gas\Review_v0.js:129:function belle_review_computeStatus(bucket, debitKubun, gross) {
gas\Review_v0.js:150:function belle_review_applyUiOverridesToState(stateSheet, stateMap, uiSheet) {
gas\Review_v0.js:202:function belle_review_syncUiFromState(stateSheet, stateMap, uiSheet) {
gas\Review_v0.js:262:function belle_buildReviewFromDoneQueue() {
gas\Review_v0.js:415:function belle_review_countNeedsReview() {
gas\Review_v0.js:439:function belle_exportYayoiCsvFromReview(options) {
gas\Review_v0.js:577:function belle_exportYayoiCsvFromReview() {
gas\Review_v0.js:581:function belle_backfillReviewReasonsJa() {
gas\Review_v0.js:675:function belle_backfillReviewReasonsJa() {
gas\Code.js:6:function belle_healthCheck() {
gas\Code.js:17:function belle_setupScriptProperties() {
gas\Code.js:33:function belle_appendRow(values) {
gas\Code.js:51:function belle_appendRow() {
gas\Code.js:60:function belle_listFilesInFolder() {
gas\Code.js:108:function belle_queueFolderFilesToSheet() {
gas\Code.js:176:function belle_queueFolderFilesToSheet() {
gas\Code.js:189:function belle_getGeminiConfig() {
gas\Code.js:204:function belle_callGeminiOcr(imageBlob) {
gas\Code.js:267:function belle_processQueueOnce(options) {
gas\Code.js:380:function belle_processQueueOnce() {
gas\Code.js:387:function belle_appendSkipLogRows(ss, sheetName, details, exportedAtIso) {
gas\Code.js:419:function belle_exportYayoiCsvFromDoneRows(options) {
gas\Code.js:674:function belle_exportYayoiCsvFromDoneRows() {
gas\Code.js:682:function belle_exportYayoiCsvFromDoneRows_force() {
gas\Code.js:686:function belle_parseBool(value, defaultValue) {
gas\ReviewReasons_ja_v0.js:5:function belle_reviewReasonJa(code, context) {
```

## 5. Script Properties 一覧（必須/任意、デフォルト、影響箇所）
- BELLE_SHEET_ID: 必須（複数関数で未設定時に例外）。主に Queue/OCR/Review/Export が参照。
- BELLE_SHEET_NAME: 任意（belle_appendRow は未設定時 OCR_RAW を既定値として使用）。Queue/OCR は BELLE_QUEUE_SHEET_NAME が無い場合に必要。
- BELLE_QUEUE_SHEET_NAME: 任意（Queue/OCR/Reviewで使用。未設定時は BELLE_SHEET_NAME を使用）。
- BELLE_DRIVE_FOLDER_ID: belle_listFilesInFolder で必須。出力フォルダ未指定時の代替としても使用。
- BELLE_OUTPUT_FOLDER_ID: 任意（Review Export/Done Export の出力先。未設定時は BELLE_DRIVE_FOLDER_ID）。
- (removed) legacy import log property was removed in fallback-v0.
- BELLE_SKIP_LOG_SHEET_NAME: 任意（既定 EXPORT_SKIP_LOG）。Done Export の skip log で使用。
- BELLE_REVIEW_STATE_SHEET_NAME: 任意（既定 REVIEW_STATE）。Review State の参照/生成に使用。
- BELLE_REVIEW_UI_SHEET_NAME: 任意（既定 REVIEW_UI）。Review UI の参照/生成に使用。
- BELLE_REVIEW_LOG_SHEET_NAME: 任意（既定 REVIEW_LOG）。Review生成の重複防止ログに使用。
- BELLE_STRICT_EXPORT: 任意（既定 false）。Review Export の STRICT/PARTIAL 判定。
- BELLE_EXPORT_BATCH_MAX_ROWS: 任意（既定 5000）。Review Export の1回出力上限。
- BELLE_CSV_ENCODING: 任意（既定 SHIFT_JIS）。Review Export/Done Export のCSV文字コード。
- BELLE_CSV_EOL: 任意（既定 CRLF）。Review Export/Done Export の改行コード。
- BELLE_INVOICE_SUFFIX_MODE: 任意（既定 OFF）。Done Export のメモ末尾付加に使用。
- BELLE_GEMINI_API_KEY: 必須（Gemini OCR で未設定時に例外）。
- BELLE_GEMINI_MODEL: 必須（Gemini OCR で未設定時に例外）。
- BELLE_GEMINI_SLEEP_MS: 任意（既定 500）。OCR処理の待機。
- BELLE_MAX_ITEMS_PER_RUN: 任意（既定 1）。OCR処理の最大件数。

## 6. 既知の注意点（コードから確実に言える範囲）
- SpreadsheetApp.getUi の呼び出しは存在しない（gas内検索で該当なし）。
- REVIEW_STATE / REVIEW_UI / REVIEW_LOG / IMPORT_LOG / EXPORT_SKIP_LOG は存在しない場合に insertSheet で自動作成される。
- REVIEW_YAYOI はコード内参照が存在しない（gas内検索で該当なし）。
# **WARNING: Legacy (review-sheet-v0). Do not use for fallback-v0. Use docs/SYSTEM_OVERVIEW_FALLBACK_V0.md instead.**