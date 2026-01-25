
# Deprecation Registry

This file records code that is scheduled for removal or has been removed during refactor.

## Format (one entry per item)
- ID: CLN-XXXX
- Status: PROPOSED | REMOVED
- Area: queue | ocr | export | logs | tests | docs
- Target: file/function/symbol
- Reason: why it can be removed
- Proof:
  - rg references
  - tests proving behavior
- Rollback: commit/tag to revert

## Entries
- ID: CLN-0005
- Status: PROPOSED
- Area: queue
- Target: gas/Code.js:belle_queue_ensureHeaderMap, gas/Review_v0.js:belle_queue_ensureHeaderMapForExport
- Reason: duplicate header-map helpers for queue/export; risk of drift as headers evolve
- Proof:
  - rg references: `rg -n "belle_queue_ensureHeaderMap" gas`, `rg -n "belle_queue_ensureHeaderMapForExport" gas`
  - tests: test_queue_header_map_parity.js (parity across wrappers)
- Rollback: revert commit that introduces belle_queue_ensureHeaderMapCanonical_ and wrapper delegation
- ID: CLN-0006
- Status: REMOVED
- Area: queue
- Target: gas/Code.js:belle_healthCheck
- Reason: deprecated helper with no runtime or test references
- Proof:
  - rg: `rg -n "belle_healthCheck\\b" gas tests`
  - tests: npm test
- Rollback: revert eccdaea
- ID: CLN-0007
- Status: REMOVED
- Area: queue
- Target: gas/Code.js:belle_setupScriptProperties
- Reason: deprecated helper with no runtime or test references
- Proof:
  - rg: `rg -n "belle_setupScriptProperties\\b" gas tests`
  - tests: npm test
- Rollback: revert eccdaea
- ID: CLN-0008
- Status: REMOVED
- Area: queue
- Target: gas/Code.js:belle_appendRow, gas/Code.js:belle_appendRow_test
- Reason: deprecated helper/test with no runtime or test references
- Proof:
  - rg: `rg -n "belle_appendRow\\b" gas tests`, `rg -n "belle_appendRow_test\\b" gas tests`
  - tests: npm test
- Rollback: revert eccdaea
- ID: CLN-0009
- Status: PROPOSED
- Area: export
- Target: gas/Review_v0.js: EXPORT_LOG schema enforcement (guard on mismatch)
- Reason: EXPORT_LOG is stateful for dedupe; should guard on schema mismatch and use header map for extra columns
- Proof:
  - tests: test_export_log_schema_guard.js
- Rollback: revert <pending>
