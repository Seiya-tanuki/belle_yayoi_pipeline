# AgentOS commands (pseudo-commands)

These are **natural-language commands** you can type into Codex chat. The root `AGENTS.md` instructs the agent to treat them as commands.

## Lane commands
1. `相談役を起動`
   - Activates Consult lane for this thread.
   - Use for: research, planning, writing specs, judging, evolving AgentOS.

2. `実装役を起動`
   - Implementation must start in a fresh thread.
   - In VS Code, run command **Codex: New Chat** (command ID: `chatgpt.newChat`) and paste the spec path.

## Artifact commands
3. `この内容で仕様書作成`
   - Creates/updates a spec in `.spec/specs/` using `$spec-writer` and `$spec-check`.

4. `このレポートをジャッジして`
   - Reviews diffs + report against the spec using `$judge`.

5. `AgentOSを進化して`
   - Propose and apply changes to AGENTS/skills/playbooks/rules using `$agentos-evolve`.

## Helpful VS Code Codex commands
- New thread: `chatgpt.newChat`
- New Codex panel: `chatgpt.newCodexPanel`
- Add selection to thread context: `chatgpt.addToThread`
- Add current file to thread context: `chatgpt.addFileToThread`
