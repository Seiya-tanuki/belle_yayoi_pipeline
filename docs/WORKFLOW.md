# WORKFLOW

## 1. 全体像（fallback-v0）
- list: belle_listFilesInFolder
- queue: belle_queueFolderFilesToSheet
- ocr: belle_processQueueOnce
- export: belle_exportYayoiCsvFromReview_test（フォールバック前提・1ファイル=1行）

## 2. 重要な運用ルール
1. dev Apps Script のみで運用（prod/stgへ push/deploy しない）
2. Sheets/Drive 操作は append-only（削除/全クリア禁止）
3. OCR完了（QUEUEのstatus=DONE）後のみ export する
4. 仕訳メモ（V列）に BELLE/FBK/理由/FILE情報を必ず入れる

## 3. ランナー運用
- belle_runPipelineBatch_v0 は Queue -> OCR -> Review 更新まで
- Export は手動（belle_exportYayoiCsvFromReview_test）

## 4. 手動エクスポート
- belle_exportYayoiCsvFromReview_test をエディタから実行
- QUEUED が残っている場合は OCR_PENDING でガードされる

## 5. 動作確認（3ステップ）
1. QUEUED が残る状態で belle_exportYayoiCsvFromReview_test を実行し OCR_PENDING を確認
2. 全件 DONE 後に belle_exportYayoiCsvFromReview_test を実行
3. ログの exportedRows/exportedFiles と CSVのV列メモを確認

## 6. 参考
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- docs/PLAN_FALLBACK_EXPORT_v0.md
- docs/DIFF_CHECKLIST_fallback_v0.md