# ADR-0003: AgentOS clarity fixes for GAS paths, Git runbooks, and PowerShell encoding

## Status
- accepted

## Context
After recent AgentOS updates, a few documents still contained legacy examples or phrasing that could confuse Implement/Consult lane behavior:
- Some lane policies still referenced `src/` despite this repo using `gas/`.
- The Implement playbook runner skill still said "Do not commit or push" without lane scoping, which conflicted with the updated policy that allows agent commits after Consult-lane acceptance.
- The tag-first runbook's archive tag example could produce ambiguous or invalid-ish tag names (extra `/`, duplicate dates) when applied to the repo's branch naming convention.
- PowerShell sometimes displays Japanese text as mojibake when reading UTF-8 files without explicit encoding.
- The repo defaults line "JavaScript + `// @ts-check`" could be misread as a hard requirement per-file, while the actual typecheck behavior is driven by `tsconfig.json` (`checkJs: true`).

## Decision
Make small, documentation-only updates to reduce ambiguity:
- Replace remaining `src/` examples with `gas/` where appropriate in lane policies.
- Update `implement-playbook` guardrails to be lane-scoped: no push; no commit by default unless required by spec or instructed by Consult lane after review.
- Update `git-tag-first` runbook to:
  - use a tag-safe `<branch_slug>` (replace `/` with `-`)
  - avoid duplicate dates when archiving branches that already include a `YYYYMMDD` suffix
  - align with the agent force-push prohibition (human-only)
- Add a PowerShell UTF-8 note to `AGENTS.md`: `Get-Content -Encoding utf8 <path>`.
- Clarify the repo's typecheck reality in `AGENTS.md`: `npm run typecheck` runs `tsc` with `checkJs: true` over `gas/**/*.js`.

Files changed:
- `AGENTS.md`
- `.lanes/consult/AGENTS.md`
- `.lanes/implement/AGENTS.md`
- `.agents/skills/implement-playbook/SKILL.md`
- `.agents/skills/git-tag-first/SKILL.md`

## Consequences
- Positive: Less lane confusion; clearer tag-first usage; fewer encoding-related misunderstandings; typecheck behavior described accurately.
- Negative / risks: None expected (documentation-only). Minor risk of users relying on the new archive-tag naming without reading the full runbook; mitigated by explicit examples.

## Verification
Smallest reliable checks:
1. Confirm lane policies no longer recommend `src/` as the typical editable path:
   - `rg -n "commonly.*src/" .lanes -S` should return no matches.
2. Confirm `implement-playbook` no longer says "Do not commit or push" unscoped:
   - `rg -n "Do not commit or push" .agents/skills/implement-playbook/SKILL.md -S` should return no matches.
3. Confirm `AGENTS.md` contains the PowerShell encoding note and the `checkJs: true` typecheck description.
4. Confirm `git-tag-first` documents `<branch_slug>` and forbids agent force-push variants.

## Rollback
Revert the file edits listed above and delete `ADR-0003-agentos-clarity-fixes-for-gas-and-git.md`.
