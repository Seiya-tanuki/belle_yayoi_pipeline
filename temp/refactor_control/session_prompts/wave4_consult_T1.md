相談役を起動

この内容で仕様書作成

Wave 4 / Track T1
Create a handoff-ready spec for shared test helper extraction with conflict-safe scope.

Target spec file:
- `.spec/specs/T-20260206-TEST-T1-test-helper-library.md`

Scope intent for Implement lane:
- allow_edit:
  - `tests/helpers/*`
  - `tests/t1_*`
  - selected existing tests in an explicit allowlist (required in spec)
- forbid_edit:
  - `.spec/specs/`
  - `.agents/`
  - `.lanes/`
  - `gas/*`

Required meta:
- playbook: `refactor-boundary`
- risk: `medium`

Mandatory conflict-prevention constraints:
1. Exclusive ownership for T1:
- `tests/helpers/*`
- `tests/t1_*`
- explicitly listed migrated tests only (must be enumerated in spec `scope.allow_edit`)

2. Mandatory non-overlap with U1:
- no edits to `gas/Dashboard.html`
- no edits to `tests/u1_*`
- no edits to `tests/test_dashboard_*`

3. Forbidden edits for T1:
- all `gas/*.js` and `gas/*.html` files
- `.spec/specs/*`
- `.agents/*`
- `.lanes/*`
- `tests/test_reset_headers.js`
- `tests/test_doc_type_registry_callsite_smoke.js`

4. If implementation requires a non-owned file:
- Stop immediately.
- Report `BLOCKER: SCOPE_CONFLICT` with exact file path and reason.
- Do not continue until consult update is provided.

Spec requirements:
1. Extract reusable deterministic helper primitives for test harness setup (mock sheet/range helpers, module-load helpers, assertion helpers).
2. Keep runtime production behavior untouched (test-only refactor track).
3. Require explicit migration allowlist in the spec for existing tests to be updated.
4. Deterministic verification set must include:
- ownership/forbidden boundary proofs
- helper smoke tests (`tests/t1_*`)
- migrated-test parity checks
- repo baseline regression commands
5. Data-driven gate handling:
- include explicit observability waiver reason (`test-only, no runtime behavior change`).
6. Include rollback plan and concrete no-go conditions.

Supplemental risks (non-blocking, include in spec notes):
1. Hidden coupling in legacy test harness assumptions.
2. Flaky behavior introduced by shared mutable helper state.
3. Module load-order regressions caused by helper centralization.

After drafting, run spec-check and revise until implement-handoff ready.
Then output in Japanese:
1) short spec overview + key points
2) implement-lane copy/paste block (`実装役を起動` + spec relative path)
