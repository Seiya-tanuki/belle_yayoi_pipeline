# Playbook: tdd-standard

## When to use
Use for feature work or bug fixes where behavior can be expressed as tests.

## Core loop
1. Translate acceptance criteria IDs into **executable tests** (unit/integration as appropriate).
2. Execute Red first and ensure the test fails for the right reason.
3. Implement the smallest change to make Green pass.
4. Run the full relevant test suite and any extra verification steps in the spec.
5. Refactor for clarity, not for scope expansion.

## Evidence requirements
- Record exact Red and Green commands and outcomes in the report.
- Record AC ID coverage (`AC-*` -> verification step IDs and evidence).
- Prefer deterministic tests and stable assertions.

## Guardrails
- Do not broaden scope beyond the spec.
- Do not skip Red unless the spec includes an explicit approved waiver.
- If acceptance criteria cannot be tested, stop and ask Consult lane to refine the spec.
