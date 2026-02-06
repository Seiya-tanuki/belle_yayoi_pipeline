# Program Control Board

Last updated: 2026-02-06
Program: manager-lane bootstrap
Program lead: Codex manager prototype

## 1. Mission and Done Definition
Mission:
1. Establish manager lane assets for cross-track orchestration.
2. Provide durable external context workspace for recovery-safe operations.

Program-level done definition:
1. Manager lane policy exists under `.lanes/manager/AGENTS.md`.
2. Required manager skills and templates are present and reference-valid.
3. Bootstrap ADR and snapshot are recorded.

## 2. Operating Rules
1. No mainline merge by default.
2. Snapshot-based recovery protocol is mandatory.

## 3. Wave Dashboard
| Wave | Objective | Tracks | Max parallel | Current status | Exit gate |
| --- | --- | --- | --- | --- | --- |
| Bootstrap | Add manager lane assets | lane policy + skills + workspace templates | 1 | In progress | Consistency checks pass |

## 4. Track Board
| Track | Goal | Primary editable scope | Prompt path | Target spec path | Status | Last update | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Manager lane bootstrap | Create policy, skills, workspace and templates | `.lanes/manager`, `.agents/skills/*manager*`, `.program/manager`, `.spec/decisions` | n/a | n/a | In progress | 2026-02-06 | Run consistency checks |

## 5. Blocker Escalation Log
| Time | Severity | Blocker | Impact | Owner | Mitigation / Decision |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

## 6. Update Log
| Date | Update |
| --- | --- |
| 2026-02-06 | Created manager lane bootstrap artifacts under `.lanes/manager`, `.agents/skills`, and `.program/manager`. |
| 2026-02-06 | Added ADR-0008 and initial manager snapshot for recovery baseline. |
