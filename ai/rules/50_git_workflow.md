# 50_git_workflow.md (Git workflow)

## 1. Working tree cleanliness
1. `.ai/` is git-ignored and must not appear in `git status --porcelain`.
2. Whether a task requires a clean working tree is defined by the TaskSpec.
3. Default stance (unless TaskSpec says otherwise):
   - It is OK to have uncommitted changes **that the task itself produces**.
   - Do not commit unless the TaskSpec asks for it.

## 2. Commits
1. If the TaskSpec requests commits:
   - Make minimal, logically grouped commits.
   - Use clear commit messages (imperative mood).
2. If commits are not requested:
   - Leave changes uncommitted and report what changed.

## 3. Branches
Branch strategy is project-specific. If not specified, do not assume.

