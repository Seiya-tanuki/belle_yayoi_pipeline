
# Invariants (must not be broken)

## Product invariants
1) Receipt pipeline behavior is preserved unless a task explicitly changes it.
2) CC pipeline behavior is preserved unless a task explicitly changes it.
3) Exported CSV content semantics must remain stable; dedupe must prevent double export.

## System invariants
1) Sheet creation is schema-driven; header mismatch triggers rotation instead of silent corruption.
   - Exception: stateful sheets used for dedupe (e.g., EXPORT_LOG) must NOT be rotated automatically; they guard and abort on mismatch.
2) Logging separation is strict:
   - QUEUE_SKIP_LOG: queue-time skips
   - EXPORT_SKIP_LOG: export-time skips
   - EXPORT_GUARD_LOG: export blocked/guard reasons
   - PERF_LOG: performance/telemetry
3) Queue scan must not crash the system:
   - unknown/multi-page PDFs are skipped at queue time (safety-first policy).
4) "One worker tick = bounded work":
   - CC uses stage caching so that each worker performs at most one Gemini call per item.

## Engineering invariants
1) Must keep "npm test" green.
2) Prefer additive tests for refactors; do not delete coverage to make tests pass.
3) When deleting legacy code, record:
   - what was deleted
   - why it is safe
   - how to rollback
   (see docs/refactor/04_deprecation_registry.md)
4) All Script Properties access must be routed through canonical config helpers (gas/Config_v0.js); no direct calls elsewhere.
5) Legacy property aliases (e.g., BELLE_SHEET_NAME, BELLE_OCR_CLAIM_CURSOR) are resolved only in Config_v0.js and must preserve prior behavior until removal.
6) Production GAS modules must not expose *_test entrypoints; manual operations use the primary entrypoints or automated tests.
7) DocTypeRegistry_v0.js is the canonical doc_type spec; adding a doc_type requires registry updates and tests, not scattered conditionals.

## Terminology
- doc_type: receipt | cc_statement | bank_statement (future)
- stage1 cache: CC page classification JSON stored in ocr_json when page_type=transactions
- stage2: CC transaction extraction JSON stored in ocr_json after DONE
