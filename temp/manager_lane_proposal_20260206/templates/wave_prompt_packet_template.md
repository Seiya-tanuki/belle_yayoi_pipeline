# Wave Prompt Packet (Template)

## Wave meta
- wave_id:
- objective:
- tracks:
- max_parallel:
- shared_freeze_files:
  - 

## A. Consult prompts
### Track <ID>
- file: `temp/refactor_control/session_prompts/waveX_consult_<ID>.md`
- purpose:
- required constraints:
  1.
  2.

### Gatekeeper
- file: `temp/refactor_control/session_prompts/waveX_consult_gatekeeper.md`
- required checks:
  1. Spec-driven gate
  2. Test-driven gate
  3. Data-driven gate
  4. Conflict prevention

## B. Implement prompts
### Track <ID>
- file: `temp/refactor_control/session_prompts/waveX_implement_<ID>.md`
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

