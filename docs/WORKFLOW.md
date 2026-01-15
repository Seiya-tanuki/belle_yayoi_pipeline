# WORKFLOW（実装の流れ）

## 1. 全体像（v0）
1. GASがDrive上の画像を受け取る
2. Geminiへ画像+promptを送信し、JSONを取得
3. JSONをスプレッドシートへ追記（raw保存）
4. 変換ジョブが Sheets から JSON を読み、正規化→弥生CSVを生成
5. 弥生会計へインポート（人手）

## 2. 重要な設計上の分離
1. OCR：証拠の抽出のみ（計算・推測禁止）
2. 正規化：算術で値を確定してよい（監査可能）
3. 変換：決定表に従い税区分を確定し、CSVを吐く

## 3. エラー運用
1. FAIL：再OCR または手入力修正
2. WARN：CSVは出すが、税区分や日付を確認

## �J��/�f�v���C�̈��S�^�p�iv0�j
1. push �� dev Apps Script �v���W�F�N�g�̂݁i.clasp.json �̓R�~�b�g���Ȃ��j
2. stg/prod �ւ� push/deploy �͐l�Ԃ��蓮�Ŏ��s
3. Sheets/Drive ����͌��� append-only�i�폜��㏑���̊֐��͋֎~�j
4. �ݒ�l�iID�ށj�� Script Properties �ɕۑ����A�R�[�h����Q��

## OCR execution (v0)
1. Queue files: belle_queueFolderFilesToSheet_test (Drive -> Sheet QUEUED)
2. Process queue: belle_processQueueOnce_test (QUEUED -> DONE/ERROR, writes ocr_json/ocr_error)
3. v0 processes images only; PDFs are marked SKIPPED.
4. Updates are limited to columns A, G, H on existing rows; no deletes.

## Yayoi CSV export (v0)
1. Ensure DONE rows exist with valid ocr_json
2. Run belle_exportYayoiCsvFromDoneRows_test
3. A headerless CSV is saved to Drive; IMPORT_LOG prevents duplicate outputs

## Yayoi CSV export (v0) - CSV encoding
1. Default is SHIFT_JIS + CRLF
2. Use BELLE_CSV_ENCODING / BELLE_CSV_EOL to override
3. Set BELLE_INVOICE_SUFFIX_MODE=AUTO to append invoice suffix

## Yayoi CSV export (v0) - force export
1. Use belle_exportYayoiCsvFromDoneRows_force_test for dev-only re-export
2. This ignores IMPORT_LOG and may create duplicate CSV files

## Runner trigger (v0)
1. Use time-driven trigger every 5 minutes
2. Recommended: BELLE_RUN_MAX_SECONDS=240
3. Recommended: BELLE_RUN_MAX_OCR_ITEMS_PER_BATCH=5

## Review flow (v0.2)
1. Runner does Queue -> OCR -> Review only (no auto CSV export)
2. Fix rows with review_status=NEEDS_REVIEW in REVIEW_YAYOI
3. Export from Review via menu (PARTIAL or STRICT)

## Manual export (editor)
1. Run belle_exportYayoiCsvFromReview_test from the editor
2. UI menu works only for container-bound spreadsheets

## Review UI/State (v0.2)
1. REVIEW_STATE is internal truth; do not edit
2. REVIEW_UI is the only editable sheet for users
3. Legacy REVIEW_YAYOI is not used (do not edit)
4. Manual export: run belle_exportYayoiCsvFromReview_test from editor
