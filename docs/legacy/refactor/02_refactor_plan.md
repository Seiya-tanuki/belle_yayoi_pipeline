> HISTORICAL: Do not use this document as current spec.

# Refactor Plan (Phase 5)

## Objective
Make the multi-pipeline architecture scalable (2 -> 3+ doc_types) by reducing legacy drift, clarifying boundaries, and establishing stable conventions + agent contract.

## Sequence (recommended)
1) Inventory & risk assessment
2) Legacy removal plan (safe deletions only)
3) Consolidate log plumbing and eliminate duplicated append logic
4) Normalize doc_type branching patterns
5) Simplify property access and configuration schema
6) Final rename pass (only when tests are strong)

## Deliverables
- docs/refactor/* updated with final rules and registries
- refactor/reports/* containing evidence and anchors
- clean code surface for adding bank_statement later

## Success criteria
1) Adding a new doc_type requires:
   - minimal edits to existing files
   - one new prompt module + one validator + one export mapper
2) No duplicated log append code paths
3) Clear, testable contracts between queue/OCR/export modules
