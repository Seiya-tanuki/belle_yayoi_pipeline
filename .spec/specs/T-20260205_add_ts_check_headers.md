# T-20260205: Add `// @ts-check` headers to core GAS modules

## Meta
- id: T-20260205
- owner_lane: consult -> implement
- risk: low
- playbook: tdd-standard
- scope:
  - allow_edit:
    - gas/
  - forbid_edit:
    - .spec/specs/
    - .agents/
    - .lanes/
- web_search: disabled
- decision_refs:
  - ADR-0001

## Goal
Add a `// @ts-check` header to the following GAS files so that all core modules use a consistent header convention:
- `gas/Drive.js`
- `gas/Gemini.js`
- `gas/Log.js`
- `gas/Pdf.js`
- `gas/Queue.js`
- `gas/Sheet.js`

## Non-goals
- Do not change runtime logic or behavior.
- Do not reformat code, reorder declarations, or rename symbols.
- Do not add or change any other comments (beyond inserting `// @ts-check`).
- Do not edit any files outside `gas/`.

## Context / Constraints
- This repo uses TypeScript `tsc` with `checkJs: true` over `gas/**/*.js` (`npm run typecheck`).
- Keep comments ASCII-only in `gas/*.js`. (`// @ts-check` is ASCII.)
- Insert `// @ts-check` as the **first line** of each listed file.
  - For files that already start with `// NOTE: Keep comments ASCII only.`, insert `// @ts-check` above it, keeping a blank line between header blocks consistent with existing files (e.g., `gas/Export.js`).

## Acceptance Criteria (testable)
1. The first line of each listed file is exactly `// @ts-check`.
2. Diffs for the listed files contain only the inserted `// @ts-check` header (no other code changes).
3. `npm run typecheck` succeeds.

## Verification
1. Header check (must pass):
   - `node -e "const fs=require('fs');const files=['gas/Drive.js','gas/Gemini.js','gas/Log.js','gas/Pdf.js','gas/Queue.js','gas/Sheet.js'];let ok=true;for(const f of files){const first=fs.readFileSync(f,'utf8').split(/\\r?\\n/,1)[0];if(first.trim()!=='// @ts-check'){console.error(f+': first line is '+JSON.stringify(first));ok=false;}}process.exit(ok?0:1);"`
2. Typecheck (must pass):
   - `npm run typecheck`
3. Fast regression (must pass):
   - `node tests/test_csv_row_regression.js`

## Safety / Rollback
- Risk is low (comment-only changes).
- Rollback: revert the commit or remove the inserted `// @ts-check` lines from the six files.

## Implementation notes (optional)
- Prefer editing each file with a minimal patch that preserves line endings and avoids touching any other lines.
