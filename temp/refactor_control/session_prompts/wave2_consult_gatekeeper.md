相談役を起動

Wave 2 / Consult Gatekeeper
Review both C1/C2 specs after they are drafted and ensure they are conflict-safe for parallel implementation.

Target specs:
- `.spec/specs/T-20260206-CORE-C1-export-skeleton-extraction.md`
- `.spec/specs/T-20260206-CORE-C2-queue-claim-stale-split.md`

Checklist:
1. No overlap in active `scope.allow_edit` file ownership between C1 and C2.
2. AC IDs, traceability matrix, and deterministic verification exist for both specs.
3. `refactor-boundary` proof commands are concrete and runnable.
4. Observability continuity/waiver is explicit and valid under three-drive rules.
5. Rollback/no-go conditions are concrete for medium-risk refactor.

Output:
1. Accept/Revise decision for each spec.
2. Any required wording fixes before implement handoff.
3. Final launch order recommendation for C1/C2 parallel start.
