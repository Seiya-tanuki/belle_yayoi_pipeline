# CODEX_REPORT_CONTRACT.md

This contract defines the required structure and content of each TaskReport:
`.ai/taskchain/reports/<ID>.report.md`

## 1. Language (MUST)
1. TaskReports MUST be written in English.
2. The report frontmatter MUST include:
   - `language: "en"`
   - `language_exceptions: []` (empty unless unavoidable)

## 2. Report identity (MUST)
Each report MUST start with a YAML frontmatter:

```yaml
---
id: T0001
type: task_report
generated_at: "2026-01-31T00:00:00+09:00"
language: "en"
language_exceptions: []
task_status: done_pending_review
---
```

## 3. Required sections (MUST)

Use Markdown headings exactly as follows.

1. `# Summary`
   - What you did in 3-8 bullet points max.
2. `# Scope`
   - What you changed (files/dirs)
   - What you intentionally did NOT change
3. `# Changes`
   - Key design/implementation decisions
   - Include reasoning if non-obvious
4. `# Evidence`
   - Commands run (with results summary)
   - Test results summary
   - File paths for key changes
5. `# Acceptance`
   - `## Machine`
     - Each acceptance.machine step and its pass/fail
   - `## Human`
     - The human checks requested by the TaskSpec (state if pending)
6. `# Risks and Follow-ups`
   - Remaining risks, TODOs, or suggested next tasks
7. `# Notes`
   - Optional: anything else important for Belle/human review

## 4. Evidence style (SHOULD)
1. Prefer short excerpts and file paths over long logs.
2. If a command output is long, summarize and reference the log file under `.ai/logs/` (runtime).
