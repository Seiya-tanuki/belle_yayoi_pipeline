# Consult Gatekeeper Prompt (Template)

相談役を起動

Wave <N> / Consult Gatekeeper
Review track spec readiness for implement handoff.

Target spec(s):
- `.spec/specs/<SPEC_ID>.md`

Checklist:
1. Spec-driven gate:
- AC IDs are stable and testable.
- Traceability matrix maps all AC IDs to deterministic verification steps.
2. Test-driven gate:
- Red/Green evidence plan exists when playbook requires it.
3. Data-driven gate:
- observability plan exists for runtime behavior changes, or explicit waiver reason.
4. Conflict prevention:
- scope allow/forbid boundaries are explicit and minimal.
- boundary proof commands cover tracked/staged/unstaged/untracked when required.
5. Verification quality:
- commands are runnable and deterministic.
6. Safety:
- no-go conditions and rollback steps are operational.

Output format (strict):
1. Accept/Revise decision.
2. Blocking findings first.
3. Exact required fixes if Revise.
4. Final launch recommendation:
   - GO / HOLD
   - required start conditions.

