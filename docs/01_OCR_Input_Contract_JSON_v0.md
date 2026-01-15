# 01_OCR_Input_Contract_JSON_v0

本書は Gemini OCR の出力JSONを「入力契約（Contract）」として固定する。

## 1. 目的
1. OCRの出力がブレても、後段の変換ロジックが安定して動く境界を定義する。
2. 「推測禁止」「計算禁止」を守り、監査可能なデータパイプラインを維持する。

## 2. 必須/重要フィールド
MVPで強く依存するフィールドは次の通り。

1. transaction_date（YYYY-MM-DD または null）
2. date_basis（issue_date を優先）
3. merchant（最小限の店名/発行元）
4. receipt_total_jpy（合計・総額）
5. qualified_invoice.registration_number（適格番号。見える場合のみ）
6. tax_meta（税率印字の有無、内税/外税の印字）
7. tax_breakdown（税率別内訳。数値が印字されている場合のみ）

## 3. 禁止事項
1. 制度推測（例：「インボイス制度開始前の可能性」など）
2. 金額計算による補完（例：合計×税率、税込=税抜+税）
3. 根拠のない税率付与（食品だから8%等）

## 4. tax_rate の根拠（tax_rate_basis）
line_items.tax_rate を設定する場合は basis を必ず付与する。

1. line：明細行に税率が直接印字されている
2. legend：凡例（※は軽減8%等）と、明細の印が対応している
3. document：票全体に単一税率が明記されており、明細へ適用してよい
4. unknown：上記に該当せず、tax_rate は unknown

## 5. プロンプト
prompts/receipt_ocr_prompt_v0.txt を使用する。
