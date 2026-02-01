# 05_Quality_Gates_v0

変換処理を「止めずに回す」ための品質ゲート。入力JSONごとに OK / WARN / FAIL を判定する。

## 1. 判定の目的
1. OK：自動で弥生CSVを生成して良い
2. WARN：CSVは生成するが、確認が必要（運用で目視・差戻し）
3. FAIL：CSV生成を抑止し、手修正または再OCRが必要

## 2. OK 条件（例）
1. transaction_date が存在
2. receipt_total_jpy が存在
3. 税率が確定できる（8/10 または 8+10）
4. bucket 合計が total と一致（許容誤差0）

## 3. WARN 条件（例）
1. 税率は確定できたが、根拠が弱い（tax_meta のみ、line_items 不完全）
2. has_multiple_rates の判定が null（混在の可能性が残る）
3. merchant が null（摘要が弱い）
4. invoice_reg_no が形式不確実（桁欠け等）

## 4. FAIL 条件（例）
1. transaction_date が null
2. receipt_total_jpy が null
3. 税率が確定不能（unknown のまま）
4. rate が 8/10 以外（5%、不明税率等）
5. bucket 合計が total と一致しない（大きな乖離）

## 5. 出力の取り扱い
1. FAIL は Sheets 上に「要対応」として出し、CSV出力しない（または別フォルダ隔離）
2. WARN は CSV 生成しつつ、同時に WARN 理由を別列に記録

## 6. Receipt total layering (OCR vs business)
- OCR is factual: `receipt_total_jpy` may be null when not visible.
- Business/export requires a total: null triggers `INVALID_SCHEMA` and a retry path.
