# PLAN_FALLBACK_EXPORT_v0

## 1. 背景と目的
- ゴール: 不明点があっても必ずCSV化し、修正は弥生側で行う。
- 監査性: file_id / drive_url / 理由コードを弥生側で見える形で残す。

## 2. 現行（review-sheet-v0）の要約
- パイプライン: belle_listFilesInFolder -> belle_queueFolderFilesToSheet -> belle_processQueueOnce -> belle_buildReviewFromDoneQueue -> belle_exportYayoiCsvFromReview
- シート: REVIEW_STATE / REVIEW_UI / REVIEW_LOG / EXPORT_LOG / EXPORT_SKIP_LOG
- 入口関数: belle_runPipelineBatch_v0（export無効が既定）, belle_exportYayoiCsvFromReview_test（手動）
- 参照: docs/PROJECT_STATE_SNAPSHOT_fallback_branch.md

## 3. フォールバック優先版 v0 要件
- 不明点があってもCSVは必ず出す。
- 弥生側で確実に識別・修正できるよう、memo/摘要に理由コード + file_id + file_name を残す。
- REVIEW_UI/REVIEW_STATE は原則使わない方針（監査と再実行整合性は維持）。

## 4. 差分方針（残す/置換/削除）
- 残す:
  - belle_queueFolderFilesToSheet / belle_processQueueOnce / EXPORT_LOG / EXPORT_SKIP_LOG
- 置換:
  - belle_exportYayoiCsvFromReview をフォールバック優先に変更
- 削除/無効化:
  - REVIEW_UI 前提の STRICT_BLOCKED 運用（フォールバックでは不要）
- 共存案:
  - BELLE_EXPORT_MODE = REVIEW | FALLBACK を追加し、分岐で共存

## 5. 実装ステップ案
1) export 関数の分岐設計（REVIEW/FALLBACK）
2) フォールバック用の memo/摘要設計（理由コード・file_id・file_name）
3) EXPORT_LOG / EXPORT_SKIP_LOG の出力ルール調整
4) REVIEW_STATE/REVIEW_UI の参照を最小化
5) docs/WORKFLOW.md / docs/CONFIG.md をフォールバック運用に整理

## 6. 設定（Script Properties）案
- 追加案:
  - BELLE_EXPORT_MODE (REVIEW|FALLBACK)
  - BELLE_FALLBACK_REASON_PREFIX (memo識別子)
- 既存利用:
  - BELLE_CSV_ENCODING / BELLE_CSV_EOL
  - BELLE_OUTPUT_FOLDER_ID / BELLE_SKIP_LOG_SHEET_NAME

## 7. 監査ログ/運用フロー
- EXPORT_LOG: 出力済み行の再出力防止
- EXPORT_SKIP_LOG: それでも出力不能な例外だけ記録
- memo/摘要に file_id / file_name / reason_code を必ず残す

## 8. リスクと対策
- 税区分の暫定値で過大控除の恐れ:
  - 安全側の暫定値を採用し、理由コードで明示
- 弥生側修正漏れ:
- memo/摘要に識別子（file_id / file_name）を必ず残す
- トレーサビリティ:
  - file_id -> CSV -> EXPORT_LOG の紐付けを維持

## 9. 手動テスト観点
1) フォールバックモードで CSV が必ず出ること
2) memo/摘要に reason_code + file_id + file_name が残ること
3) EXPORT_LOG に記録されること
4) EXPORT_SKIP_LOG は例外のみ記録されること

## 10. 次ターン実装対象（予定）
- 変更対象ファイル:
  - gas/Review_v0.js（export分岐の追加）
  - gas/Code.js（Runnerのexport制御確認）
  - docs/WORKFLOW.md / docs/CONFIG.md（フォールバック運用）
- 追加/変更する関数:
  - belle_exportYayoiCsvFromReview（REVIEW/FALLBACK分岐）
  - fallback用のreason/memo生成ヘルパー（名称は実装時に確定）
