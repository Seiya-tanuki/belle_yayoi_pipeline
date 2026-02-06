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
   - Report evidence matches the Verification section.
   - Every AC ID in the spec is covered by evidence in the report.
4. For `playbook: tdd-standard`, verify TDD evidence:
   - Red evidence exists (expected fail before implementation), unless explicit approved waiver exists.
   - Green evidence exists (expected pass after implementation).
5. Verify observability evidence:
   - Runtime behavior changes include observability evidence, or explicit approved waiver.
6. Check boundaries:
   - No forbidden edits (spec/AgentOS) were made.
7. Decision
   - Accept: criteria met, evidence present, risks acceptable.
   - Revise: list blocking issues (including missing three-drive evidence), assign to Implement lane.
   - Re-spec: spec is insufficient or changed; propose spec edits.

## Output
- Provide the decision in Japanese in chat.
- If changes to specs/AgentOS are needed, propose edits and (if asked) apply them in English files.
