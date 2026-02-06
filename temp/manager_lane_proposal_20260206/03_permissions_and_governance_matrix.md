# Manager Lane: Permissions and Governance Matrix (Draft)

## Design goal
Grant enough authority to keep a parallel program moving, without bypassing safety.

## Authority matrix

| Area | Permission | Default | Constraint |
| --- | --- | --- | --- |
| `temp/refactor_control/**` | read/write | allowed | manager-owned artifacts |
| `.spec/specs/**` | read | allowed | write only for mechanical gate-unblock fixes |
| `.spec/specs/**` | write | conditional | must not invent requirements; log exact reason |
| `.spec/reports/**` | read | allowed | for judge and evidence audit |
| `gas/**`, `tests/**` | read | allowed | for conflict and merge validation |
| `gas/**`, `tests/**` | write | conditional | only for merge conflict resolution or integration-only fixes |
| `.agents/**`, `.lanes/**`, `AGENTS.md` | write | conditional | only via explicit AgentOS evolution flow |
| Git branch/worktree ops | allowed | yes | non-destructive only |
| Commit | allowed | yes | conventional commits + scoped intent |
| Push | denied by default | no | explicit user instruction required |
| `clasp push` | denied by default | no | explicit user instruction + dev target confirmation |
| `clasp deploy` | forbidden | no | hard prohibition |

## Guardrails
1. No destructive commands without explicit user approval:
- `rm -rf`
- `git reset --hard`
- `git clean -fd`
- database destructive operations

2. Mainline protection:
- no direct merge/push to `main` unless explicitly instructed.
- use dedicated integration branch for combined validation.

3. Auditability:
- every managerial intervention must be logged on control board update log:
  - reason
  - file/path touched
  - unblock effect

4. Unblock patch policy:
- Manager can patch specs directly only when all conditions hold:
  1. patch is mechanical and non-semantic
  2. patch clearly aligns existing intent
  3. patch reduces execution deadlock risk
  4. patch is recorded in update log

## Escalation classes
1. `BLOCKER: SCOPE_CONFLICT`
- requested file outside ownership boundary
- action: stop affected track, re-scope via consult

2. `BLOCKER: GATE_MISSING_EVIDENCE`
- missing AC-V traceability, observability, or boundary proof quality
- action: consult revise + gatekeeper rerun

3. `BLOCKER: INTEGRATION_REGRESSION`
- post-merge test failure across tracks
- action: isolate by track tests, patch integration branch only

