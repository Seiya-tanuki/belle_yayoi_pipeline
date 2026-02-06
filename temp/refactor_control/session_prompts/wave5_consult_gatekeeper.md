相談役を起動

Wave 5 / Consult Gatekeeper
Review X1 integration spec readiness for migration-safe implementation.

Target spec:
- `.spec/specs/T-20260206-INTEG-X1-correlation-key-normalization.md`

Checklist:
1. Spec-driven gate:
- AC IDs exist and are testable.
- Traceability matrix maps every AC to deterministic V steps.
2. Migration-safe preconditions:
- `risk: high` is set.
- rollback plan is concrete and phase-aware.
- observability plan includes thresholds and abort criteria.
- safety constraints are explicit (no destructive commands, hard-stop conditions).
3. Phase plan completeness:
- Phase A/B/C/D are explicitly defined and logically reversible until cleanup.
- cleanup phase is gated by confirmation criteria.
4. Data-driven gate:
- correlation key signals, emit points, and verification mapping are explicit.
- mismatch/consistency invariants are measurable.
5. Conflict prevention:
- `scope.allow_edit` is explicit and minimal for integration.
- boundary proofs cover tracked/staged/unstaged/untracked.
6. Verification quality:
- commands are runnable (PowerShell compatible).
- end-to-end dashboard -> queue -> worker -> export propagation proof exists.
7. Safety:
- no-go conditions and rollback triggers are operational.

Output:
1. Accept/Revise decision.
2. Exact required fixes if Revise.
3. Final launch recommendation for Wave 5 (single-thread integration start condition).
