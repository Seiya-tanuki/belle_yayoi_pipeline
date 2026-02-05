---
name: repo-onboard
description: >
  Onboard an existing repository to Belle AgentOS. Scans the repo for language/tooling/tests,
  proposes minimal AgentOS adjustments, and optionally applies them via agentos-evolve.
---

# Repo Onboard

## Goals
- Discover how to build/test/lint the project.
- Identify risky areas (data migrations, deploy scripts, ...).
- Produce a minimal customization plan for AGENTS/skills/playbooks.

## Procedure
1. Identify tech stack and structure:
   - languages, package managers, build tools, CI
2. Identify test commands and the fastest smoke test.
3. Find existing conventions:
   - formatting, linting, commit conventions
4. Propose AgentOS updates:
   - repository-specific Verification defaults
   - safe paths for Implement lane
   - any additional playbooks needed
5. If asked to apply, run `$agentos-evolve` and record an ADR.
