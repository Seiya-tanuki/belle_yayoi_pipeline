# WORKFLOW

## 1. 全体像（fallback-v0）
- list: belle_listFilesInFolder
- queue: belle_queueFolderFilesToSheet
- ocr: belle_processQueueOnce
- export: belle_exportYayoiCsvFromReview_test（フォールバック前提・1ファイル=1行）

## 2. 重要な運用ルール
1. dev Apps Script のみで運用（prod/stgへ push/deploy しない）
2. Sheets/Drive 操作は append-only（削除/全クリア禁止）
3. OCR結果に依存せず必ずCSVを出す（フォールバック優先）
4. 仕訳メモ（V列）に BELLE/FBK/理由/FILE情報を必ず入れる

## 3. ランナー運用
- belle_runPipelineBatch_v0 は Queue -> OCR -> Review 更新まで
- Export は手動（belle_exportYayoiCsvFromReview_test）

## 4. 手動エクスポート
- belle_exportYayoiCsvFromReview_test をエディタから実行
- 1ファイル=1行で出力し、IMPORT_LOGで重複を防止

## 5. 参考
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/PLAN_FALLBACK_EXPORT_v0.md
- docs/DIFF_CHECKLIST_fallback_v0.md