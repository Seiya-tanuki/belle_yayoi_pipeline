# WORKFLOW

## 1. 全体像（review-sheet-v0）
- list: belle_listFilesInFolder
- queue: belle_queueFolderFilesToSheet
- ocr: belle_processQueueOnce
- review: belle_buildReviewFromDoneQueue
- export: belle_exportYayoiCsvFromReview_test（手動）

## 2. 重要な運用ルール
1. dev Apps Script のみで運用（prod/stgへ push/deploy しない）
2. Sheets/Drive 操作は append-only（削除/全クリア禁止）
3. REVIEW_STATE は内部状態（ユーザーが触らない）
4. REVIEW_UI はユーザーが触る唯一のシート（override 列のみ）

## 3. ランナー運用
- belle_runPipelineBatch_v0 は Queue -> OCR -> Review 更新まで
- Export は BELLE_RUN_DO_EXPORT=false を前提

## 4. 手動エクスポート
- belle_exportYayoiCsvFromReview_test をエディタから実行
- STRICT_EXPORT=true の場合、review_status=NEEDS_REVIEW が残っていると出力しない

## 5. 参考
- docs/CONFIG.md
- docs/PROJECT_STATE_SNAPSHOT.md
- docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md
- SYSTEM_OVERVIEW_REVIEW_SHEET_V0.md