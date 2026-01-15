# WORKFLOW（実装の流れ）

## 1. 全体像（v0）
1. GASがDrive上の画像を受け取る
2. Geminiへ画像+promptを送信し、JSONを取得
3. JSONをスプレッドシートへ追記（raw保存）
4. 変換ジョブが Sheets から JSON を読み、正規化→弥生CSVを生成
5. 弥生会計へインポート（人手）

## 2. 重要な設計上の分離
1. OCR：証拠の抽出のみ（計算・推測禁止）
2. 正規化：算術で値を確定してよい（監査可能）
3. 変換：決定表に従い税区分を確定し、CSVを吐く

## 3. エラー運用
1. FAIL：再OCR または手入力修正
2. WARN：CSVは出すが、税区分や日付を確認

## �J��/�f�v���C�̈��S�^�p�iv0�j
1. push �� dev Apps Script �v���W�F�N�g�̂݁i.clasp.json �̓R�~�b�g���Ȃ��j
2. stg/prod �ւ� push/deploy �͐l�Ԃ��蓮�Ŏ��s
3. Sheets/Drive ����͌��� append-only�i�폜��㏑���̊֐��͋֎~�j
4. �ݒ�l�iID�ށj�� Script Properties �ɕۑ����A�R�[�h����Q��
