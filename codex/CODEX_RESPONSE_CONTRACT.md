# Codex Response Contract (v1.5)

目的: ベルがレビューしやすいよう、Codexの完了報告の“型”を固定する（認知ズレを減らす）。

---

## 必須フォーマット

1. **結論サマリ**（3〜7行）
2. **実行モード**
   1) Plan-driven / Pack-driven
   2) 使用した正本（Plan path or PACK_ROOT + entry plan）
3. **Scope遵守の宣言**
   1) Goals / Non-goals を再掲
   2) Do not modify に触れていない根拠（必要なら `git diff --name-only`）
4. **Packs（使用した場合）**
   1) pack 名 / type（support|execution） / version / install_path or workspace_path
   2) must_read invariants/gates の要点（短く）
   3) pack と repo policy の矛盾がないこと（矛盾があるなら停止して報告）
5. **Pack-driven 追加（Execution Pack）**
   1) Drift check（base_sha vs HEAD）
   2) Verbatim assets validation（ある場合: sha256 等）
6. **変更内容（要点）**
7. **変更したファイル**（一覧）
8. **根拠（Evidence）**
   - 重要な主張（挙動、互換、境界）には、可能な限り `file:line` / `rg` 結果 / テスト名を添える
9. **安全性の説明**
   - ガード、互換、CLN-ID、破壊的操作ゲートの有無
10. **テスト結果**
   - 実行したコマンドと結果（本文/PIIは出さない）
11. **手動確認 or 同等の自動検証**
   - 人間が実行する手順、または parity/safety tests による代替ゲート
12. **最終状態**
   1) `git show --stat --oneline HEAD`
   2) `git status --porcelain`（final）
