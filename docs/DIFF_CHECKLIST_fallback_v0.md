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
- reason_code / file_id / file_name が memo/摘要に残る設計になっているか
- EXPORT_LOG / EXPORT_SKIP_LOG の用途が明記されているか
- legacy IMPORT_LOG が残っている場合は手動で rename する旨が明記されているか
