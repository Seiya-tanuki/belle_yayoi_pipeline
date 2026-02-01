# DECISIONS（意思決定ログ）

## 1. 仕訳日付
1. OCRが抽出した日付のうち、**発行日（issue_date）**を仕訳日付として採用する。

## 2. 勘定科目（MVP固定）
1. 借方：仮払金
2. 貸方：現金
3. 取り込み後、弥生側で科目の振替・再分類を行う前提とする。

## 3. 税区分（判断対象）
1. 借方税区分のみを決定対象とする（貸方税区分は「対象外」）
2. 税率は 10% / 軽減8% を扱う。
3. インボイス適格/区分80/区分50/控不 は取引日付と登録番号の有無で決め打ちする（詳細は docs/03）。

## 4. 弥生CSVの基本方針
1. 25項目形式・ヘッダなし（1仕訳=1行）
2. 金額は税込で入力し、税金額列（10列目・16列目）は原則空欄とする（v0）。

## 5. receipt_total_jpy null handling (2026-02-01)
- OCR output is factual and allows null when total is not visible.
- Business/export requires a total; null is treated as INVALID_SCHEMA and retried.
- This preserves retry behavior while avoiding speculative totals.
