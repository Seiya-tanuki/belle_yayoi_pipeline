# 02_Normalized_Model

OCR JSON をそのまま弥生にマッピングしない。中間の「正規モデル（Normalized）」を定義し、変換の単純化と監査可能性を確保する。

## 1. NormalizedTransaction（ヘッダ）
1. id：一意ID（生成）
2. date：仕訳日付（issue_date固定）
3. merchant：発行元名（最小限）
4. total_gross_jpy：総額（税込）
5. invoice_reg_no：適格登録番号（T+13桁へ正規化。無い場合は null）
6. rate_presence：
   1) printed：10 / 8 / multiple / null
   2) has_multiple_rates：true/false/null
7. notes：
   1) doc_type：receipt/invoice/statement/payment_slip/unknown
   2) warnings：文字列配列（WARN理由）

## 2. NormalizedTaxBucket（税率別バケット）
弥生出力の最小単位（1行）に対応させる。

1. rate：10 または 8
2. gross_jpy：その税率に属する税込金額
3. evidence：
   1) source：breakdown_gross / breakdown_taxable_plus_tax / total_only / unknown
   2) confidence：0.0-1.0
   3) issues：文字列配列

## 3. 正規化の算術（OCR禁止だが正規化工程は可）
正規化工程では、監査可能な算術に限り値を確定してよい。

1. gross と tax がある場合：taxable = gross - tax（整数）
2. taxable と tax がある場合：gross = taxable + tax
3. has_multiple_rates は「8/10の両方で何らかの数値が確定できた」場合 true とする

## 4. 失敗時の扱い
1. total_gross_jpy が取れない場合：FAIL（docs/05）
2. 税率が確定できない場合：WARN または FAIL（docs/03 と docs/05 に従う）
