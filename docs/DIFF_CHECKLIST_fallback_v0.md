# DIFF_CHECKLIST_fallback_v0

## コード側
- REVIEW_STATE / REVIEW_UI に依存する処理がフォールバックに残っていないか
- belle_exportYayoiCsvFromReview が REVIEW 前提のままになっていないか
- UI前提（SpreadsheetApp.getUi）が存在しないこと

## ドキュメント側
- REVIEW_YAYOI / BELLE_REVIEW_SHEET_NAME が残っていないか
- OCR_RAW / QUEUE の表記ズレがないか
- フォールバック運用とレビュー運用が混在していないか

## 命名/ログ
- reason_code / file_id / drive_url が memo/摘要に残る設計になっているか
- IMPORT_LOG / EXPORT_SKIP_LOG の用途が明記されているか