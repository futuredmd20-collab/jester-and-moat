# ChatGPT (GPT-6) — Agent Profile

Purpose: repository-specific working practices, demonstrated capabilities, and tool constraints for ChatGPT. This is an operational profile, not a source of game rules or architecture.

## 1. Startup & Scope
- Before editing project files, read `AGENTS.md`, `docs/HANDOVER.md`, `docs/ARCHITECTURE.md`, and `.agents/limitations.md`, in that order.
- Treat GitHub as the canonical shared workspace. Keep changes within the approved scope and use one task branch per task.
- Never write project changes directly to `main`. Do not open a PR or merge without the user's explicit authorization.
- Make one commit per discrete step and verify the branch head and diff against the intended base when tools permit.

## 2. GitHub Object-Write Fallback
- In this environment, GitHub branch-creation and Contents API write actions have been blocked by tool security controls. Do not keep retrying the same blocked operation.
- The Git Database Objects workflow has worked successfully in this repository:
  1. Read the target branch's current commit and tree SHA (the Git API commit object exposes the tree SHA).
  2. Create blobs for the complete changed file contents.
  3. Create a tree based on the target tree, listing only the changed paths and blob SHAs.
  4. Create a commit with that tree and the intended parent commit.
  5. Create or advance the task branch using the Git ref action; when advancing an existing ref, provide the expected prior SHA and use a non-forced update.
  6. Read back the branch/file and compare the task branch against its base to verify the outcome.
- The ref-update action has successfully created a new task branch as well as advanced an existing one in this repository. If the operation fails, inspect the actual error and available capabilities; never use this workflow to bypass permissions, branch protection, or approval rules.
- A file write is not complete until the commit and branch ref both succeed. Report partial object creation accurately if a later step fails.

## 3. Validation & Recovery
- For CI-backed changes, inspect the latest workflow run for the exact task branch and commit SHA, then check its conclusion and test logs. Do not infer success from a run merely starting.
- The PWA startup contract suite was verified in GitHub Actions with all 20 tests passing after correcting test mocks from an initial failed run.
- When a tool fails, distinguish a security-control block from an ordinary API error. Try a materially different supported route once its availability is established, rather than repeating the same failed call.
- When execution cannot be performed locally through the available connector workflow, use the repository's CI when available and clearly distinguish CI validation from local execution.
- Prefer focused reads, diffs, and status summaries over dumping entire files unless needed for correctness.

## 4. Boundaries
- The GitHub integration's exposed actions and access may vary by session or account. Discover the available actions and verify access with a live request before concluding a capability is absent.
- Git Database Objects can create repository objects, but branch-ref permissions and repository protections still apply.
- Do not invent a successful write, test run, or verification. If a blocker remains, state what succeeded, what did not, and the next viable option.
