# Program Control Board

Last updated: 2026-02-06 20:56
Program: manager-lane bootstrap and quality uplift
Program lead: Codex manager prototype

## 1. Mission and Done Definition
Mission:
1. Establish manager lane assets for cross-track orchestration.
2. Provide durable external context workspace for recovery-safe operations.

Program-level done definition:
1. Manager lane policy exists under `.lanes/manager/AGENTS.md`.
2. Required manager skills and templates are present and reference-valid.
3. Bootstrap ADR and snapshot are recorded.
4. Manager quality gate passes with full score.

## 2. Operating Rules
1. No mainline merge by default.
2. Snapshot-based recovery protocol is mandatory.

## 3. Wave Dashboard
| Wave | Objective | Tracks | Max parallel | Current status | Exit gate |
| --- | --- | --- | --- | --- | --- |
| Bootstrap | Add manager lane assets | lane policy + skills + workspace templates | 1 | Completed | Consistency checks pass |
| Quality uplift | Raise manager lane reliability to 10/10 | templates + quality gate + migration mapping | 1 | Completed | Quality gate score is 10/10 |

## 4. Track Board
| Track | Goal | Primary editable scope | Prompt path | Target spec path | Status | Last update | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Manager lane bootstrap | Create policy, skills, workspace and templates | `.lanes/manager`, `.agents/skills/*manager*`, `.program/manager`, `.spec/decisions` | n/a | n/a | Completed | 2026-02-06 | Maintain artifacts through manager workflows |
| Manager quality uplift | Improve fidelity and enforceability vs `temp` artifacts | `.program/manager/templates`, `.program/manager/tools`, `.program/manager/reports`, `.program/manager/migrations`, `.agents/skills/manager-quality-gate` | n/a | n/a | Completed | 2026-02-06 | Use quality gate before future cross-track launches |

## 5. Blocker Escalation Log
| Time | Severity | Blocker | Impact | Owner | Mitigation / Decision |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

## 6. Update Log
| Date | Update |
| --- | --- |
| 2026-02-06 | Created manager lane bootstrap artifacts under `.lanes/manager`, `.agents/skills`, and `.program/manager`. |
| 2026-02-06 | Added ADR-0008 and initial manager snapshot for recovery baseline. |
| 2026-02-06 | Added high-fidelity consult/implement/gatekeeper prompt templates to match proven `temp` prompt quality. |
| 2026-02-06 | Added script-based manager quality gate and manager-quality-gate skill for enforceable launch readiness. |
| 2026-02-06 | Added `temp` to manager workspace migration mapping and comparison self-analysis report. |
| 2026-02-06 | Fixed manager quality gate script issues and confirmed `CHECKS_PASS:7/7`, `SCORE_10:10`. |
| 2026-02-06 | Recorded quality uplift ADR and snapshot for recovery-safe continuation. |
