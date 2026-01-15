# 09_Dev_Environment_Clasp

## 目的
GASをローカル開発し、Git管理しながら **誤push/誤deploy** を防ぐ。

## 前提
- clasp v3 は TypeScript を内蔵トランスパイルしない（TS採用時は別途ビルドが必要）。
- v0 は「GAS(JavaScript) + @ts-check + JSDoc」でビルド無し運用とする。
- Apps Script API を有効化していないと clasp が失敗する場合がある。
  - script.google.com のユーザー設定で「Google Apps Script API」を ON。

## 運用ルール（重要）
1. dev / stg / prod は別の Apps Script プロジェクトにする。
2. .clasp.json はコミットしない（scriptId差し替え事故防止）。
3. push は dev のみ。stg/prod は人間が実行する。
4. 秘密値（Sheet ID / Folder ID / API Key）は Script Properties に格納し、リポジトリに置かない。

## コマンド（最小）
1. ログイン: clasp login
2. dev作成: clasp create --title "belle-yayoi-dev" --type standalone --rootDir gas
3. 状態: clasp status
4. push: clasp push

## 切替（推奨）
- dev/stg/prod それぞれの .clasp.json を configs/clasp/ に保存し、作業時にコピーする。
