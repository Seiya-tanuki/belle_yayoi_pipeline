# CONFIG（v0の設定・後で差し替える部分）

## 1. 会計設定（未確定）
顧客の弥生設定が不明なため、v0では次を仮定する。

1. 本則課税
2. 税込入力（税区分は「込」）
3. 端数処理は弥生側に依存（v0では金額を“印字ベース”で確定）

## 2. 固定値（MVP）
1. debit_account = "仮払金"
2. credit_account = "現金"
3. credit_tax_kubun = "対象外"
4. identifier_flag = "2000"
5. type = "0"
6. adjustment = "NO"

## 3. 可変（将来の設定化候補）
1. 支払手段 → 貸方科目の自動選択（現金/普通預金/未払金/クレカ等）
2. 税率不明時の既定挙動（FAIL か 10%でWARN か）
3. インボイス経過措置の期間（法改正対応）

## �J�����iclasp�j
1. .clasp.json �̓��[�J����p�iGit�Ǘ����Ȃ��j
2. configs/clasp/ �� dev/stg/prod �̍T����u���A�R�s�[�Őؑւ���i�C�Ӂj
3. Script Properties �Ɉȉ���ۑ�����z��:
   - BELLE_SHEET_ID
   - BELLE_DRIVE_FOLDER_ID
   - BELLE_GEMINI_API_KEY�i�K�v�Ȃ�j
