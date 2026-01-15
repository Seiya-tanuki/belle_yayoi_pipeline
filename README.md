# belle_yayoi_pipeline_v0

このリポジトリは「Gemini OCR（JSON）→ 正規化 → 弥生会計インポート用CSV（25項目・ヘッダなし）」の変換ロジックを、コーディングエージェントにブレなく実装させるための**仕様ドキュメント集**です。

## 1. 成果物（MVP）
1. 入力：Gemini OCRのJSON（docs/01_OCR_Input_Contract_JSON_v0.md の契約）
2. 出力：弥生会計「弥生取り込み（インポート）形式（弥生会計05以降）」の仕訳データ（25項目、ヘッダなし）
3. 主要判断：**借方税区分**（インボイス適格/区分80/区分50/控不、税率 10/軽減8）

## 2. 重要な前提（現時点の合意）
1. 仕訳日付は **発行日（issue_date）で固定**（OCRで date_basis=issue_date を期待）
2. 勘定科目は顧客指定で固定：
   1) 借方勘定科目：仮払金
   2) 貸方勘定科目：現金
3. 弥生側の詳細設定（本則/簡易、入力方式など）は未確定のため、v0では「基本設定」を仮定しつつ、後で差し替え可能な形にします（docs/CONFIG.md）。

## 3. まず読むべき順番
1. docs/00_PRD_Overview.md（目的とMVP境界）
2. docs/01_OCR_Input_Contract_JSON_v0.md（入力契約）
3. docs/03_Tax_Determination_Spec.md（税区分の決定表：この案件の心臓）
4. docs/04_Yayoi_CSV_Spec_25cols.md（25項目の列仕様）
5. docs/05_Quality_Gates_v0.md（止める/流すの境界）

## 4. ディレクトリ構成
1. docs/ : 実装仕様
2. prompts/ : Gemini OCRプロンプト（v0）
3. templates/ : 変換テンプレ（列定義・デフォルト値）
4. fixtures/ : 回帰テスト用のOCR JSONサンプル
5. reference/ : 参考（顧客サンプルCSVのコピー、参照URL）

## 5. 次のアクション（Cursorでの開発開始時）
1. 変換プログラムの骨格（parse → normalize → map → emit csv）を作成
2. fixtures を入力として、期待CSVが出る回帰テストを作成
3. GAS連携は「OCR JSONをSheetsに記録する」段までで一旦完了（変換は別ジョブでも可）
