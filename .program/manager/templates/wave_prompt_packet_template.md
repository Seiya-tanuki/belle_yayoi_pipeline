# Wave Prompt Packet (Template)

## Wave meta
- wave_id:
- objective:
- tracks:
- max_parallel:
- source_foundation_report:
  - `.program/manager/reports/P-<YYYYMMDD>-<slug>-program-foundation.md`
- source_lock_matrix:
  - `.program/manager/registry/track_lock_matrix.yaml`
- source_gate_contract:
  - `.program/manager/registry/gate_contract.yaml`
- shared_freeze_files:
  - 
- required_prompt_templates:
  - `.program/manager/templates/consult_track_prompt_template.md`
  - `.program/manager/templates/consult_gatekeeper_prompt_template.md`
  - `.program/manager/templates/implement_track_prompt_template.md`

## A. Consult prompts
### Track <ID>
- file:
- purpose:
- required constraints:
  1.
  2.

### Gatekeeper
- file:
- required checks:
  1. Spec-driven gate
  2. Test-driven gate
  3. Data-driven gate
  4. Conflict prevention

## B. Implement prompts
### Track <ID>
- file:
- scope allowlist:
  - 
- scope forbidlist:
  - 
- stop condition:
  - `BLOCKER: SCOPE_CONFLICT <path> <reason>`
- mandatory verification:
  1.
  2.

## C. Non-blocking risk overlay
1.
2.

## D. Launch condition
1.
2.

## E. Quality gate (must pass before launch)
0. Program foundation is present and up to date:
   - `project_type` is free-form text
   - `change_vectors` are defined and mapped to controls
   - lock matrix and gate contract are synchronized
1. Every track has both consult and implement prompt files (unless intentionally deferred).
2. Prompt files include required blocks:
   - objective
   - preconditions
   - ownership boundaries
   - hard-stop rule
   - verification set
3. Gatekeeper prompt exists and uses strict output format:
   - Accept/Revise
   - exact required fixes
   - GO/HOLD recommendation
