---
name: parallel-scope-designer
description: >
  Design conflict-safe ownership boundaries for parallel consult/implement tracks.
  Produces allowlist/forbidlist overlays and freeze-file declarations.
---

# Parallel Scope Designer

## Inputs
- Candidate tracks
- Candidate editable files per track
- Shared risk hotspots

## Procedure
1. Build ownership matrix by track:
   - production allowlist
   - test allowlist
   - explicit forbidlist
2. Detect path overlaps and classify:
   - safe
   - serial-only overlap
   - blocking overlap
3. Define freeze files for shared hotspots.
4. Produce prompt-ready boundary blocks:
   - allowlist
   - forbidlist
   - hard-stop message:
     `BLOCKER: SCOPE_CONFLICT <exact_file_path> <reason>`
5. Set wave max parallel value based on overlap risk.

## Output requirements
- Ownership matrix table.
- GO/HOLD recommendation for wave launch.
- Per-track overlay text for prompt files.

## Guardrails
- Unknown ownership means HOLD until clarified.
- Do not allow overlapping production file ownership in same active wave.

