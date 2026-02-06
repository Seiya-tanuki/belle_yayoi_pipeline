# ADR-0005: Standardize post-spec chat handoff output (summary + implement copy/paste)

## Status
- accepted

## Context
After creating a spec, the Consult lane often hands off to Implement lane.
Without a consistent handoff format, two recurring friction points appear:
- The user must re-interpret the spec to understand what will be changed and how to verify it.
- Starting Implement lane requires repeatedly reconstructing the correct "start command + spec path" message.

We want a deterministic, low-effort handoff that is produced every time a spec is created or updated.

## Decision
Update AgentOS guidance so that after a spec is written and `$spec-check` passes, the agent always outputs two artifacts in chat (Japanese):
1. A short spec overview + key points (what will be implemented/changed, boundaries/non-goals, and verification commands).
2. An Implement-lane copy/paste block containing:
   - `実装役を起動`
   - the spec relative path (e.g., `.spec/specs/T-XXXX_<slug>.md`)

Files changed:
- `AGENTS.md`
- `.lanes/consult/AGENTS.md`
- `.agents/skills/spec-writer/SKILL.md`

## Consequences
- Positive: Faster and less error-prone handoffs; easier review of intended changes; consistent implement kickoff.
- Negative / risks: Slightly longer chat output after spec creation; mitigated by keeping the overview concise.

## Verification
Smallest reliable checks:
1. Open `.agents/skills/spec-writer/SKILL.md` and confirm it mandates the two post-spec chat outputs.
2. Open `.lanes/consult/AGENTS.md` and confirm the Consult lane output expectations include the two artifacts.
3. Open `AGENTS.md` and confirm pseudo-command `この内容で仕様書作成` mentions the two artifacts.

## Rollback
Revert the file edits listed above and delete `ADR-0005-spec-handoff-summary-and-implement-copypaste.md`.
