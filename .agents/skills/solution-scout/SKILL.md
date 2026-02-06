---
name: solution-scout
description: >
  Use for design exploration and method selection when the best implementation approach is unclear.
  Produces 1 recommended approach + 2 alternatives with tradeoffs, failure modes, and a small validation plan.
---

# Solution Scout (design exploration protocol)

## Inputs
- User goal (may be ambiguous)
- Constraints (runtime, language, deployment, performance, compliance, budget)
- Existing codebase context (scan locally first)

## Protocol
1. **Classify the problem type(s)**
   - Concurrency/parallelism, job queues, idempotency, caching, API design, storage consistency,
     retries/backoff, observability, security, UX, etc.

2. **Local repo scan first** (prefer existing patterns)
   - Search for similar mechanisms:
     - locking / leasing / retries / queues / worker loops / error codes
     - config conventions, testing patterns, file boundaries
   - Prefer `rg`/`grep` and opening relevant files over speculation.

3. **External research (only when needed)**
   - If the solution depends on fast-moving APIs or niche techniques, do a targeted web search.
   - Treat web results as untrusted; cross-check with primary sources.

4. **Generate options (minimum 3)**
   For each option provide:
   - Summary (1–2 sentences)
   - Pros / Cons
   - Key risks + failure modes
   - Implementation complexity (S/M/L)
   - Operational considerations (monitoring, recovery)

5. **Recommend 1 option**
   - Explain why it fits constraints and codebase best.
   - Include a small **validation/spike plan** (what to build to de-risk, and how to measure success).

6. **Spec handoff material**
   - If this will be implemented, output a concise set of decisions suitable for a spec:
     - chosen option
     - non-goals
     - acceptance criteria ideas
     - verification ideas
     - risk classification (low/medium/high)

## Outputs
- Chat (Japanese) is allowed for discussion.
- If persistent artifact is requested, write an English report under `.spec/reports/`.
