# Session Prompt Index

## Wave 0 (Consult)
1. O1 consult session
- `temp/refactor_control/session_prompts/wave0_consult_O1.md`

2. O2 consult session
- `temp/refactor_control/session_prompts/wave0_consult_O2.md`

3. O3 consult session
- `temp/refactor_control/session_prompts/wave0_consult_O3.md`

## Wave 1 (Implement)
1. O1 implement session
- `temp/refactor_control/session_prompts/wave1_implement_O1.md`

2. O2 implement session
- `temp/refactor_control/session_prompts/wave1_implement_O2.md`

3. O3 implement session
- `temp/refactor_control/session_prompts/wave1_implement_O3.md`

## Wave 2 (Consult)
1. C1 consult session
- `temp/refactor_control/session_prompts/wave2_consult_C1.md`

2. C2 consult session
- `temp/refactor_control/session_prompts/wave2_consult_C2.md`

3. Wave 2 consult gatekeeper session
- `temp/refactor_control/session_prompts/wave2_consult_gatekeeper.md`

How to use:
1. Open a new session for each agent thread.
2. Paste the full content of the matching prompt file.
3. Keep parallel execution under explicit file ownership constraints.
4. If any thread reports `BLOCKER: SCOPE_CONFLICT`, pause that track and escalate to consult lead.
