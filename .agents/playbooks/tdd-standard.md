# Playbook: tdd-standard

## When to use
Use for feature work or bug fixes where behavior can be expressed as tests.

## Core loop
1. Translate acceptance criteria into **executable tests** (unit/integration as appropriate).
2. Ensure the new/updated test fails for the right reason.
3. Implement the smallest change to make it pass.
4. Run the full relevant test suite.
5. Refactor for clarity, not for scope expansion.

## Evidence requirements
- Record the exact test commands and outcomes in the report.
- Prefer deterministic tests and stable assertions.

## Guardrails
- Do not broaden scope beyond the spec.
- If acceptance criteria cannot be tested, stop and ask Consult lane to refine the spec.
