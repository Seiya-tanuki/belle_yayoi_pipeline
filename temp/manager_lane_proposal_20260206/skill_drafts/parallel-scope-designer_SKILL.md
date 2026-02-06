---
name: parallel-scope-designer
description: >
  Design conflict-safe ownership boundaries for parallel consult/implement tracks.
  Produces allowlist/forbidlist overlays and freeze-file declarations.
---

# Parallel Scope Designer (Draft)

## When to use
Use before launching any parallel wave.

## Inputs
1. Candidate tracks and target files
2. Existing shared files/hot zones
3. Wave risk level

## Procedure
1. Build per-track ownership table:
   - owned production files
   - owned test files
   - forbidden files
2. Detect overlap and classify:
   - safe (no overlap)
   - managed overlap (needs serial lock)
   - blocking overlap (must re-scope)
3. Define shared freeze files.
4. Output prompt overlays with:
   - hard-stop line
   - boundary proof command requirement
5. Attach non-blocking risk notes per track.

## Required output
1. Ownership matrix.
2. Conflict decision (`GO`/`HOLD`).
3. Prompt-ready boundary block text.

## Safety
1. Treat unknown ownership as blocked until clarified.
2. Enforce explicit stop protocol for non-owned file needs.

