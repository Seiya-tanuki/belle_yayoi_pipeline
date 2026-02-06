# Playbook: refactor-boundary

## When to use
Use for refactors where the main risk is boundary drift (logic leaking into the wrong module).

## Steps
1. Restate the boundary in the spec (what must live where, what must not).
2. Add **boundary tests** or mechanical checks first:
   - `rg`/`grep` checks for forbidden symbols in forbidden files
   - AST-based checks if available
   - observability contract checks (existing signal names/fields remain available unless spec allows change)
3. Apply the refactor in small commits **locally** (but do not commit via agent unless explicitly requested).
4. Run tests.
5. Produce "proofs":
   - search results showing forbidden signatures are absent
   - the dispatch/entrypoint logic references only approved abstractions
   - observability checks (signal continuity or explicitly approved signal migration)

## Evidence requirements
- Include:
  1. commands run
  2. test results
  3. boundary proof outputs
  4. observability proof outputs (or explicit approved waiver)

## Guardrails
- No behavior change unless the spec explicitly allows it.
- No observability signal/schema regression unless the spec explicitly allows it.
- If behavior changes are unavoidable, stop and request spec update.
