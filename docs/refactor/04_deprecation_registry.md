
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
