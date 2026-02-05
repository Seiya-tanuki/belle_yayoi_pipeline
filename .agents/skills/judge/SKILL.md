---
name: judge
description: >
  Judge an implementation: review diffs and the latest report against the spec.
  Produces an accept/revise decision with concrete next actions and, if needed, a spec update proposal.
---

# Judge

## Inputs
- Spec path (required)
- Report path (recommended)

## Procedure
1. Read the spec and restate acceptance criteria.
2. Review changes:
   - Prefer VS Code Codex `/review` (if available) to review uncommitted diffs.
   - Otherwise use `git diff` and inspect modified files.
3. Verify evidence:
   - Tests/logs in report match the Verification section.
4. Check boundaries:
   - No forbidden edits (spec/AgentOS) were made.
5. Decision
   - Accept: criteria met, evidence present, risks acceptable.
   - Revise: list blocking issues, assign to Implement lane.
   - Re-spec: spec is insufficient or changed; propose spec edits.

## Output
- Provide the decision in Japanese in chat.
- If changes to specs/AgentOS are needed, propose edits and (if asked) apply them in English files.
