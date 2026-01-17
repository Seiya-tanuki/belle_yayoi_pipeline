# CLEANUP_TODO_fallback_v0

## 目的 / 運用ルール
- ここに列挙した項目は「将来の負債になり得るが、今すぐ削除するとリスクがある要素」。
- この文書は削除の条件/手順/確認を明文化するためのメモであり、**今すぐ削除しない**。
- 作業時は必ず専用ブランチで実施し、テストと手動確認を行う。

## 削除対象一覧

### CLN-001: Legacy export log guard (IMPORT_LOG)
- 種別: guard / compat
- 場所: `gas/Review_v0.js:36-48`
- 現在の役割: EXPORT_LOG が無く legacy IMPORT_LOG が残っているときに export をガード停止。
- 残す理由: 旧シート名の混入による重複出力/誤ログ更新を防止。
- 削除してよい条件:
  - すべての環境で EXPORT_LOG へリネーム済み
  - IMPORT_LOG が存在しないことを確認済み
- 削除時の手順案:
  1) `LEGACY_NAME` チェックと guard を削除
  2) `EXPORT_LOG_MISSING_LEGACY_PRESENT` を参照する docs を削除
- 削除後の確認手順:
  - `belle_exportYayoiCsvFromReview_test` を実行し、EXPORT_LOG 作成/追記が正常であること
- リスク評価: Med

### CLN-002: OCR legacy normalize (ERROR_RETRYABLE + ocr_json)
- 種別: migration / compat
- 場所: `gas/Code.js:413-450`（OCR_LEGACY_NORMALIZE, LEGACY_ERROR_IN_OCR_JSON）
- 現在の役割: status=ERROR_RETRYABLE だが ocr_json にエラー文字列が入っている行を修復。
- 残す理由: 既存データの回復性を維持するため。
- 削除してよい条件:
  - すべての環境で該当「壊れ行」が存在しないことを確認済み
  - OCR運用が安定し、ocr_json への誤保存が再発しないことを確認済み
- 削除時の手順案:
  1) OCR_LEGACY_NORMALIZE ブロックを削除
  2) LEGACY_ERROR_IN_OCR_JSON のコード/ログを削除
- 削除後の確認手順:
  - ERROR_RETRYABLE が次回OCR対象に含まれ続けることを確認
- リスク評価: High

### CLN-003: legacy status "ERROR" 互換
- 種別: compat
- 場所: `gas/Code.js:467, 495, 682`（normalized === "ERROR"）
- 現在の役割: 旧status "ERROR" を ERROR_RETRYABLE と同様に扱う。
- 残す理由: 旧データの残存に対応。
- 削除してよい条件:
  - OCR_RAW に status="ERROR" が存在しないことを確認済み
- 削除時の手順案:
  1) status 判定から "ERROR" を除外
  2) docs から legacy status の記述を削除
- 削除後の確認手順:
  - ERROR_RETRYABLE の再処理/カウントが正常であること
- リスク評価: Med

### CLN-004: BELLE_SHEET_NAME legacy fallback
- 種別: compat
- 場所: `gas/Code.js:346-349`（BELLE_SHEET_NAME_DEPRECATED）
- 現在の役割: 旧プロパティ BELLE_SHEET_NAME を QUEUE 名として受け入れる。
- 残す理由: 旧設定を壊さないため。
- 削除してよい条件:
  - 全環境が BELLE_QUEUE_SHEET_NAME を設定済み
- 削除時の手順案:
  1) BELLE_SHEET_NAME の分岐削除
  2) docs の legacy 記述削除
- 削除後の確認手順:
  - queue sheet 解決順が BELLE_QUEUE_SHEET_NAME -> OCR_RAW になること
- リスク評価: Med

### CLN-005: deprecated entrypoints
- 種別: compat / cleanup
- 場所:
  - `gas/Code.js:4,14,27,45`（@deprecated）
  - `gas/Review_v0.js:384`（belle_exportYayoiCsvFromReview alias）
- 現在の役割: 旧エントリポイントへの互換/案内。
- 残す理由: 手動実行の誤用を避けるための移行期間。
- 削除してよい条件:
  - エディタ実行/外部トリガーからの参照が無いことを確認
- 削除時の手順案:
  1) @deprecated 関数を削除
  2) docs から参照を削除
- 削除後の確認手順:
  - 主要エントリポイントのみが動作すること
- リスク評価: Low

### CLN-006: legacy review-sheet docs
- 種別: docs-only
- 場所:
  - `docs/legacy/SYSTEM_OVERVIEW_REVIEW_SHEET_V0.md:1`
  - `docs/legacy/PROJECT_STATE_SNAPSHOT_review_sheet_v0.md:160`
- 現在の役割: 旧レビュー版の参照保管。
- 残す理由: 参照履歴としての保全。
- 削除してよい条件:
  - 監査/履歴として不要になったタイミング
- 削除時の手順案:
  1) docs/legacy を削除
  2) 参照リンクを削除
- 削除後の確認手順:
  - fallback-v0 docs のみ参照されること
- リスク評価: Low

## 削除実施の推奨タイミング
- 安定版完成後
- 顧客環境への反映が完了し、旧データが存在しないことを確認後

## 削除の基本手順
1) 専用ブランチを作成
2) 対象CLNを1つずつ削除
3) npm run typecheck / npm test
4) 手動確認（OCR→export）
5) clasp push（dev）→ 本番反映

## 削除後の確認（共通）
- OCR_RETRYABLE の再処理が止まらないこと
- EXPORT_LOG の重複抑止が維持されること
- V列メモ / 日付フォールバックの挙動が維持されること
