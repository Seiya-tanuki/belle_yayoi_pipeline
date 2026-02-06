# ADR-0010: Remove fresh-thread requirement from Implement lane

## Status
- proposed

## Context
The Implement lane had a hard requirement to start in a fresh thread.
In practice, this caused unintended execution refusals even when operators had already reset context operationally.
Since agents cannot forcibly clear context state themselves, the strict gate created workflow friction without reliable technical enforcement.

## Decision
Remove fresh-thread as a mandatory precondition and keep anti-drift intent as operational guidance.

Updated files:
1. `AGENTS.md`
   - `実装役を起動` now enters Implement lane directly and requests spec path, without requiring `chatgpt.newChat`.
2. `.lanes/implement/AGENTS.md`
   - session hygiene now emphasizes strict spec scoping instead of mandatory new-thread enforcement.
3. `.agents/skills/implement-playbook/SKILL.md`
   - removed "confirm fresh thread" stop step.
4. `.agents/COMMANDS.md`
   - removed fresh-thread requirement and New Chat dependency from Implement command description.

## Consequences
- Positive effects
  - Eliminates false refusals on implementation start.
  - Keeps anti-drift control through spec-scoping behavior.
  - Reduces operator friction for small and iterative fixes.
- Negative effects / risks
  - More reliance on operator discipline to keep thread context clean.
  - Potential context bleed if spec-scoping is not enforced in practice.

## Verification
1. Search for mandatory fresh-thread wording in lane/command/skill files:
   - `fresh Codex thread`
   - `Implementation MUST start in a fresh`
2. Confirm no remaining mandatory rule blocks implementation start in the same thread.
3. Confirm Implement lane still enforces spec-first behavior.

## Rollback
1. Revert:
   - `AGENTS.md`
   - `.lanes/implement/AGENTS.md`
   - `.agents/skills/implement-playbook/SKILL.md`
   - `.agents/COMMANDS.md`
2. Remove this ADR file.

