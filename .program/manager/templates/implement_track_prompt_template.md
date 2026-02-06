# Implement Track Prompt (Template)

実装役を起動

Spec path:
- `.spec/specs/<SPEC_ID>.md`

Wave:
- Wave <N> / Track <ID>

Execution goal:
- Implement the spec exactly as written (`playbook: <playbook-id>`).
- <track-specific objective>

Mandatory precondition:
1. Run this track in a dedicated branch/worktree only.
2. Do not run implementation in a shared dirty branch.
3. Run boundary proof before code edits and again before finalizing.

Mandatory conflict-prevention overlay:
1. Exclusive ownership:
- `<owned path>`
- `<owned path>`

2. Forbidden file edits:
- `<forbidden path>`
- `<forbidden path>`

3. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`.
- Do not continue until consult update is provided.

Implementation method:
1. Follow spec AC/V steps exactly.
2. Keep edits within owned scope only.
3. Preserve required compatibility/contract behavior.
4. Capture required evidence and write report under `.spec/reports/`.

Required verification (from spec):
- `<Vx command or check>`
- `<Vx command or check>`

Supplemental risks (non-blocking):
1. <risk 1>
2. <risk 2>

Hard-stop conditions:
1. Any boundary proof failure.
2. Any required verification regression.
3. Any non-owned file requirement.

Final boundary check:
- `<boundary command>`
- Allowed only:
  - `<allow path>`
  - `<allow path>`

Do not push.
Do not run `clasp deploy`.
Do not run destructive commands (`rm -rf`, `git reset --hard`, `git clean -fd`).

