相談役を起動

Wave 3 / Consult Gatekeeper
Review C3 spec quality and implementation handoff safety before Wave 3 starts.

Target spec:
- `.spec/specs/T-20260206-CORE-C3-ocr-worker-state-split.md`

Checklist:
1. Spec-driven gate:
- AC IDs exist and are testable.
- Traceability matrix maps every AC to deterministic V steps.
2. Test-driven gate:
- Because playbook is `refactor-boundary`, ensure boundary/parity evidence requirements are concrete.
- If any Red/Green evidence is requested, it must be explicit and deterministic.
3. Data-driven gate:
- Observability plan exists with concrete signals, emit points, and verification mapping.
- Waiver is not accepted unless explicitly justified and safe.
4. Conflict prevention:
- `scope.allow_edit` is constrained to C3-owned files only.
- Forbidden-file list blocks Queue/Export/shared-freeze edits.
5. Verification quality:
- Boundary proof commands are runnable in PowerShell.
- Required worker transition checks cover claim-lost/writeback/error branches.
6. Safety:
- Rollback and no-go conditions are concrete and operational.

Output:
1. Accept/Revise decision.
2. Exact required edits if Revise.
3. Launch recommendation for Wave 3 implement start condition.
