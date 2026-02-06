# AgentOS commands (pseudo-commands)

These are **natural-language commands** you can type into Codex chat. The root `AGENTS.md` instructs the agent to treat them as commands.

## Lane commands
1. `相談役を起動`
   - Activates Consult lane for this thread.
   - Use for: research, planning, writing specs, judging, evolving AgentOS.

2. `実装役を起動`
   - Activates Implement lane for this thread.
   - Provide the target spec path and execute implementation from that spec.

3. `管理役を起動`
   - Activates Manager lane for this thread.
   - Use for: project-wide cross-track orchestration, parallel control, and integration management.
   - Optional: small fixes can stay on Consult + Implement only.

4. `指示書を実行 <path>`
   - Loads the instruction file at `<path>` and executes it as the primary brief.
   - Recommended for manager-led operations to reduce prompt copy/paste overhead.

5. `管理役で計画作成`
   - Runs manager planning foundation workflow for large cross-project programs.
   - Uses manager templates/registry artifacts and quality gates before wave launch.
   - `project_type` is free-form; control logic is driven by `change_vectors`.

## Artifact commands
6. `この内容で仕様書作成`
   - Creates/updates a spec in `.spec/specs/` using `$spec-writer` and `$spec-check`.

7. `このレポートをジャッジして`
   - Reviews diffs + report against the spec using `$judge`.

8. `AgentOSを進化して`
   - Propose and apply changes to AGENTS/skills/playbooks/rules using `$agentos-evolve`.

## Helpful VS Code Codex commands
- New Codex panel: `chatgpt.newCodexPanel`
- Add selection to thread context: `chatgpt.addToThread`
- Add current file to thread context: `chatgpt.addFileToThread`
