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

## Gemini OCR (v0)
Add these Script Properties (do not commit secrets):
1. BELLE_GEMINI_API_KEY
2. BELLE_GEMINI_MODEL
3. BELLE_GEMINI_SLEEP_MS (optional, default 500)
4. BELLE_MAX_ITEMS_PER_RUN (optional, default 1)
5. BELLE_QUEUE_SHEET_NAME (optional; defaults to BELLE_SHEET_NAME)

## Yayoi CSV Export (v0)
Add these Script Properties (optional unless noted):
1. BELLE_OUTPUT_FOLDER_ID (optional; defaults to BELLE_DRIVE_FOLDER_ID)
2. BELLE_IMPORT_LOG_SHEET_NAME (optional; default IMPORT_LOG)

## Yayoi CSV Export (v0) - CSV Settings
Add these Script Properties (optional unless noted):
1. BELLE_CSV_ENCODING (optional; SHIFT_JIS or UTF8, default SHIFT_JIS)
2. BELLE_CSV_EOL (optional; CRLF or LF, default CRLF)
3. BELLE_INVOICE_SUFFIX_MODE (optional; AUTO or OFF, default OFF)

## Export Skip Log (v0)
1. BELLE_SKIP_LOG_SHEET_NAME (optional; default EXPORT_SKIP_LOG)

## Runner batch (v0)
1. BELLE_RUN_MAX_SECONDS (optional; default 240)
2. BELLE_RUN_MAX_OCR_ITEMS_PER_BATCH (optional; default 5)
3. BELLE_RUN_DO_QUEUE (optional; default true)
4. BELLE_RUN_DO_OCR (optional; default true)
5. BELLE_RUN_DO_EXPORT (optional; default true)

## Review (v0.2)
1. BELLE_REVIEW_SHEET_NAME (optional; default REVIEW_YAYOI)
2. BELLE_REVIEW_LOG_SHEET_NAME (optional; default REVIEW_LOG)
3. BELLE_STRICT_EXPORT (optional; default false)
4. BELLE_EXPORT_BATCH_MAX_ROWS (optional; default 5000)
5. BELLE_RUN_DO_EXPORT (optional; default false)

## Review sheets (v0.2)
1. BELLE_REVIEW_STATE_SHEET_NAME (optional; default REVIEW_STATE)
2. BELLE_REVIEW_UI_SHEET_NAME (optional; default REVIEW_UI)
