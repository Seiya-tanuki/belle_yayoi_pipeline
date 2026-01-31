# PROJECT_PROFILE.md

This file describes **how to run and validate this repository**.

## Environment
1. Language/runtime:
   1) Node.js (CommonJS)
   2) TypeScript (for type-checking via `tsc`)
2. Package manager: npm
3. Target platform: Google Apps Script (source under `gas/`)

## How to run (local)
1. Install:
   1) `npm ci`
2. Typecheck:
   1) `npm run typecheck`
3. Test:
   1) `npm test`

## Notes
1. Deployment/config:
   1) Clasp-related config files are intentionally **not committed** (see `.gitignore` entries like `.clasp.*.json` and `configs/clasp/*.json`).
2. Secrets handling:
   1) Do not commit secrets. Prefer `.env` and keep it ignored.
3. CI expectations:
   1) Any refactor MUST keep `npm run typecheck` and `npm test` passing.
