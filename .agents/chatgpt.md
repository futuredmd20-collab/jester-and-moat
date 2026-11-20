# ChatGPT — Agent Notes

Purpose: ChatGPT-specific GitHub practices. General rules are in `AGENTS.md` and `.agents/env-cloud.md`.

## GitHub integration

- Use the returned blob SHA when updating an existing file. Keep writes to the same path sequential and verify each resulting commit.
- Available actions and access may vary by session; verify with a live request before concluding something is unavailable.

## Git Database Objects fallback

Only when a native action is unavailable or actually fails:
1. Read the target branch's commit and tree SHA.
2. Create blobs for the complete changed files.
3. Create a tree from the target tree listing only the changed paths.
4. Create a commit with that tree and the intended parent.
5. Create or advance the task branch ref (non-forced, with the expected prior SHA).
6. Read back and compare the branch with its base.

This does not bypass permissions or protection. Report partial results accurately if a later step fails.

## CI verification

Check the workflow run for the exact branch and commit SHA, its conclusion and test logs. A run starting is not a pass. Distinguish CI validation from local execution.
