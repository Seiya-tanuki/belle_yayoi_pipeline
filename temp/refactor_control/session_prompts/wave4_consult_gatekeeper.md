相談役を起動

Wave 4 / Consult Gatekeeper
Review U1/T1 specs for parallel-implementation safety before Wave 4 starts.

Target specs:
- `.spec/specs/T-20260206-UI-U1-dashboard-script-decomposition.md`
- `.spec/specs/T-20260206-TEST-T1-test-helper-library.md`

Checklist:
1. Spec-driven gate:
- AC IDs exist and are testable.
- Traceability matrix maps every AC to deterministic V steps.
2. Test-driven gate:
- `refactor-boundary` proof commands are concrete and runnable.
- If any Red/Green requirement exists, it is explicit and deterministic.
3. Data-driven gate:
- U1: observability continuity or explicit waiver must be valid.
- T1: explicit runtime-observability waiver reason must be present (test-only track).
4. Conflict prevention:
- No overlap in `scope.allow_edit` between U1 and T1.
- U1 ownership is limited to `gas/Dashboard.html` + `tests/u1_*`.
- T1 ownership is limited to `tests/helpers/*`, `tests/t1_*`, and explicitly listed migrated tests only.
5. Verification quality:
- Boundary proofs cover tracked/staged/unstaged/untracked changes.
- U1 verifies client/server contract parity.
- T1 verifies helper migration parity.
6. Safety:
- Rollback and no-go conditions are concrete and operational.

Output:
1. Accept/Revise decision for each spec.
2. Exact required fixes if Revise.
3. Final launch recommendation for Wave 4 parallel implement start.
