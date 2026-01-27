> HISTORICAL: Do not use this document as current spec.

# Test & Release Gates

## Gates (mandatory)
1) npm test PASS
2) No change to CSV output unless explicitly requested
3) If refactor touches:
   - log schemas: include rotation tests
   - queue scanning: include PDF guard tests
   - export dedupe: include multi-run tests

## Recommended additional checks
1) Search for per-cell writes in loops:
   - setValue in for/while
2) Verify chunked writers are used:
   - belle_sheet_appendRowsInChunks_
3) Manual smoke (when asked):
   - queue -> worker -> export -> verify logs regenerated
