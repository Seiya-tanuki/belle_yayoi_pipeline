# ADR-0004: Rename `belle-judge` skill to `judge`

## Status
- accepted

## Context
The skill name `belle-judge` is longer than necessary for common usage in chat commands.
We want a simpler skill name while keeping behavior unchanged.

## Decision
Rename the skill:
- From: `belle-judge`
- To: `judge`

Update all references to use `$judge` instead of `$belle-judge`.
No functional behavior changes were made to the judging process itself.

Files changed:
- `.agents/skills/belle-judge/` -> `.agents/skills/judge/`
- `.agents/skills/judge/SKILL.md` (frontmatter `name`, title)
- `AGENTS.md` (pseudo-command + commit policy example)
- `.lanes/consult/AGENTS.md` (skill references)
- `.agents/skills/git-safe/SKILL.md` (skill reference)
- `.agents/COMMANDS.md` (skill reference)
- `.spec/decisions/ADR-0002-git-tag-first-and-agent-commit-policy.md` (skill reference)

## Consequences
- Positive: Shorter command (`$judge`) and less typing friction.
- Negative / risks: Old references (`$belle-judge`) will no longer match the renamed skill.

## Verification
Smallest reliable checks:
1. Confirm the skill exists at `.agents/skills/judge/SKILL.md` and the frontmatter `name` is `judge`.
2. Confirm the old skill command name is no longer referenced in operational docs:
   - `rg -n "\\$belle-judge" AGENTS.md .lanes .agents -S` returns no matches.
3. Confirm the old directory no longer exists:
   - `Test-Path .agents/skills/belle-judge` is `False`.

## Rollback
Rename the directory back to `.agents/skills/belle-judge/`, revert the reference edits above, and delete this ADR.
