# Consult Track Prompt (Template)

相談役を起動

この内容で仕様書作成

Wave / Track:
- Wave <N> / Track <ID>

Objective:
- <one-line objective tied to track scope>

Target spec path:
- `.spec/specs/<SPEC_ID>.md`

Required meta:
- playbook: `<playbook-id>`
- risk: `<low|medium|high>`

Scope intent for Implement lane:
- allow_edit candidate set (spec must finalize exact allowlist):
  - `<path>`
  - `<path>`
- forbid_edit baseline:
  - `.spec/specs/*`
  - `.agents/*`
  - `.lanes/*`

Mandatory execution policy:
1. <max_parallel rule>
2. explicit `scope.allow_edit` / `scope.forbid_edit`
3. non-owned path stop rule:
- `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`

Spec requirements:
1. Goal + Non-goals.
2. AC IDs (stable, testable) with traceability matrix.
3. Deterministic verification commands.
4. Three-drive gates completeness.
5. Risk/safety/no-go/rollback clarity.

After drafting:
1. Run spec-check and revise until handoff-ready.
2. Output in Japanese:
   1) short spec overview + key points
   2) implement-lane copy/paste block (`実装役を起動` + spec relative path)

