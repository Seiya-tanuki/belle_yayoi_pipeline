# AUTHORITY.md (Source of Truth & Precedence)

This file defines what is authoritative when instructions conflict.

## 1. Precedence order (highest -> lowest)

1. **Active TaskSpec** (`.ai/taskchain/tasks/<ID>.task.md`)
   - Including any referenced Plan/Pack explicitly declared in its frontmatter `authority`.
2. **AI OS contracts** (`ai/contracts/*`)
3. **AI OS rules** (`ai/rules/*`)
4. **Taskchain protocol & schemas** (`ai/taskchain/protocol.md`, `ai/taskchain/schemas/*`)
5. **AI knowledge base** (`ai/kb/*`) if present
6. **Human documentation** (`docs/*`)
7. **Chat messages / conversational context**

## 2. Chat is not authoritative
Chat messages are triggers and clarifications only.
If a chat instruction is important, it MUST be captured in:
- a TaskSpec, or
- an AI OS file under `ai/`.

## 3. Conflict handling
When you detect a conflict between authoritative sources:
1. Stop.
2. Explain the conflict in the TaskReport.
3. Propose a resolution (e.g., update rule via a dedicated task).

