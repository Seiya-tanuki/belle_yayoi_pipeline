# Phase 5 Retrospective: Why the Refactor Worked (Reproducible Playbook)

> Purpose: Capture the *reproducible* reasons Phase 5 succeeded with near‑zero manual testing, and codify a playbook to repeat the result for future refactors and doc_type additions.
>
> Audience: AI agents (Codex) + maintainers. Precision > readability.

---

## 0) Context

Phase 5 was a **large-scale refactor** of a Google Apps Script (GAS) system that had evolved from a single pipeline to multiple doc_type pipelines (receipt / cc_statement, bank_statement inactive). The key success criterion was:

1. **No business logic changes** (queue/OCR/export semantics preserved).
2. **High confidence** without relying on manual test cycles.
3. Refactor outcomes must **increase future scalability** (e.g., adding bank_statement should be “registry-only + new pipeline module + mapping + tests”, not scattered edits).

---

## 1) The single most important move: Redefine “testing” away from E2E and toward “structure”

Manual testing tends to catch “integration breakage”. But Phase 5 work was mostly **structure** (module boundaries, extraction, consolidation, dead code removal). For structural work, E2E is *expensive* and *low-signal*.

We succeeded because we shifted the primary safety net to:

1. **Boundary tests** (forbidden imports/tokens, no stray literals, no cross-domain leakage)
2. **Load-order safety tests** (GAS file-load order traps)
3. **Parity/regression tests** (pin the *meaningful outputs* and *writebacks* that must not change)

Manual tests become optional when *the expected failure modes are structural*, and we have structural tests.

---

## 2) Process architecture that prevented drift

### 2.1 “PHASE 0” template as an execution protocol

Every Codex task was required to start with:

- Scope
- Non-goals
- Files
- Steps
- Tests

This template is not documentation; it is a **control system** that restricts the search space.

Operational effect:
- Non-goals reduce “helpful” but unsafe changes.
- File list makes review and diffs predictable.
- Steps enforce incrementalism and reproducibility.

### 2.2 Three-tier knowledge layout

1. `refactor/**` (ignored): high-volume, temporary artifacts and large audit reports
2. `docs/refactor/**` (tracked): invariants, rules, checklists, CLN registry, decisions
3. Code modules: refactor outcomes

Operational effect:
- Large reports exist (keeps context) without polluting git history.
- Decisions are durable (prevents the “AI forgot” failure mode).

---

## 3) The “invariants first” strategy (why it worked)

The invariants file is the **contract** that defines “safe refactor”.

A refactor is safe when:
1. The invariants are unchanged.
2. All newly introduced constraints have tests.

Practical rule:
- If you cannot express the safety boundary as an invariant + test, the work is not ready to proceed without manual validation.

---

## 4) Recovery and interruption resilience (usage limits, partial edits, etc.)

We explicitly treated “interruption” as normal.

### 4.1 Standard recovery procedure

When work is interrupted mid-change (usage limits, tool crash, etc.):

1. Save a WIP patch (optional but recommended):
   ```bash
   git diff > /tmp/refactor_recovery/wip.patch
   git diff --stat > /tmp/refactor_recovery/wip_stat.txt
   ```
2. Reset to the last known-good tag:
   ```bash
   git reset --hard <checkpoint_tag>
   git clean -fd
   ```
3. Run full tests:
   ```bash
   npm test
   ```
4. Re-run the original instruction (do not “continue” from partial state).

Operational effect:
- The agent is never forced to reason about an inconsistent working tree.

---

## 5) Why near-zero manual testing was rational (not luck)

The safety posture came from **deterministic, enforceable gates**.

### 5.1 Structural gates (prevent “wrong change category”)

Examples of structural gates that eliminated common AI-refactor failure modes:

1. **No `_test` entrypoints in production** (guard tests + cleanup)
2. **Registry-only doc_type wiring** (anti-drift tests)
3. **Code.js entrypoint-only boundary** (prevents helper creep)
4. **Single ownership of ScriptProperties access** (Config_v0 only)

These gates prevent the codebase from regressing to “spaghetti growth” after refactor.

### 5.2 Output/behavior gates (prevent silent meaning drift)

Where semantics matter, we pinned them:

1. CSV row regression tests (receipt + cc)
2. CC stage cache writeback parity tests
3. Export dedupe and skip-log dedupe behavior tests
4. Backoff/retry semantics (shared helpers extracted, but behavior pinned)

### 5.3 Load-order gates (prevent GAS-specific deployment failures)

GAS can fail even if Node tests pass, due to file evaluation order.
Load-order tests were added per module extraction to lock down:
- “Code.js can load before Module X”
- “Module X provides required symbols when loaded”

---

## 6) Repeatable module-extraction sequence (pattern)

The refactor proceeded in an order that reduced risk:

1. **Config access consolidation** (ScriptProperties single owner)
2. **Registry consolidation** (DocTypeRegistry drives routing)
3. **Log + Sheet + Drive/Pdf + Gemini primitives** extracted into dedicated modules
4. **Queue + Export modules** extracted behind wrappers
5. **Code.js slimmed to entrypoints only**
6. **OCR modularization** (OcrCommon → OcrCcPipeline → OcrReceiptPipeline → orchestrator slim)

Why this order works:
- It moves *cross-cutting primitives* first, shrinking the surface area for later moves.
- It defers the highest-complexity domain (OCR) until a stable module boundary system exists.

---

## 7) Definition of Done (DoD) for a refactor CLN

A refactor CLN is “done” only if all items are true:

1. **Scope/Non-goals respected**
2. **Business logic unchanged** (or explicitly justified and agreed)
3. **Boundary test added or updated**
4. **Load-order safety test added or updated**
5. **Parity/regression test added if semantics could drift**
6. **docs/refactor updated** (rules/invariants + CLN registry with rollback)
7. **npm test PASS**
8. Optional but recommended:
   - checkpoint tag created and pushed when the CLN closes a major phase

---

## 8) When manual testing is still required (explicit exceptions)

Manual test becomes required when a change affects:

1. Gemini prompt / schema / model options (responseMimeType/JsonSchema etc.)
2. Drive permission behavior or file-type edge cases not covered by unit tests
3. Shift_JIS / encoding behavior with real external consumers
4. Concurrency-sensitive flows (locks, triggers, multi-minute latency patterns)

If any of the above changes occur:
- Add *at least one* targeted manual test scenario, and record it in `docs/refactor/03_checklists.md`.

---

## 9) Bank_statement readiness playbook (future reuse)

For adding a new doc_type pipeline safely, require:

1. Registry spec completed (spec completeness test passes)
2. Queue subfolder + sheet contract
3. Pipeline module: `OcrBankPipeline_v0.js` (or similar), boundary + load-order + parity tests
4. Export mapping handler, row regression tests
5. Observability: Perf/event fields must include doc_type and pipeline stage as needed
6. Backoff/retry semantics pinned by tests

This keeps “add doc_type” predictable and scalable.

---

## 10) Appendices: Copy/paste templates

### 10.1 Codex instruction header template

```text
PHASE 0
Scope:
Non-goals:
Files:
Steps:
Tests:
Evidence:
```

### 10.2 Boundary test style

- “Forbidden token” grep test
- “Allowed wrapper list” test for entrypoint modules
- “No literals outside registry” test

### 10.3 Load-order safety test style

- Load Code.js before module X and verify it does not throw
- Then load module X and verify required symbols exist

---

## 11) Key insight (one sentence)

**The refactor completed without manual testing because we replaced “trust the agent” with “trust invariant-driven constraints + structural tests + deterministic rollback”.**

