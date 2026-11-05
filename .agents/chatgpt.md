# ChatGPT (GPT-6) — Agent Profile

Purpose: repository-specific working practices, demonstrated capabilities, and tool constraints for ChatGPT. This is an operational profile, not a source of game rules or architecture.

## 1. Startup & Scope
- Before editing project files, read `AGENTS.md`, `docs/HANDOVER.md`, `docs/ARCHITECTURE.md`, and `.agents/limitations.md`, in that order.
- Treat GitHub as the canonical shared workspace. Keep changes within the approved scope and use one task branch per task.
- Never write project changes directly to `main`. Do not open a PR or merge without the user's explicit authorization.
- Make one commit per discrete step and verify the branch head and diff against the intended base when tools permit.

## 2. Remote GitHub Workflow (Default)
- For remote work, use the dedicated GitHub integration actions first: inspect the repository and `main`, search for the task branch, create it from current `main`, fetch files, update/create files on the task branch, compare the result with `main`, and open a PR when authorized.
- A user-approved workflow C or D already authorizes the branch creation and the commit/push operations specified by that workflow. Do not ask for another confirmation for those in-scope operations.
- Workflow D authorizes the draft PR after the diff has been reviewed and shown to the user. It never authorizes merging.
- Use the returned blob SHA when updating an existing file. Keep writes to a given path sequential; verify every resulting commit and the final branch contents.
- Do not use generic REST/fetch calls as a substitute for the dedicated GitHub actions.

## 3. Git Database Objects Fallback
- Use this only when the relevant native GitHub action is unavailable or actually fails. A failure of one action does not establish that other actions are blocked.
- Read the target branch's current commit and tree SHA.
- Create blobs for the complete changed file contents.
- Create a tree based on the target tree, listing only the changed paths and blob SHAs.
- Create a commit with that tree and the intended parent commit.
- Create or advance the task branch using the Git ref action; when advancing an existing ref, provide the expected prior SHA and use a non-forced update.
- Read back the branch/files and compare the task branch against its base to verify the outcome.
- This workflow does not bypass permissions, branch protection, or approval rules. Report partial object creation accurately if a later step fails.

## 4. Validation & Recovery
- For CI-backed changes, inspect the latest workflow run for the exact task branch and commit SHA, then check its conclusion and test logs. Do not infer success from a run merely starting.
- The PWA startup contract suite was verified in GitHub Actions with all 20 tests passing after correcting test mocks from an initial failed run.
- When a tool fails, distinguish a security-control block from an ordinary API error. Diagnose the specific operation and try a materially different supported route only when its availability is established.
- When execution cannot be performed locally through the available connector workflow, use the repository's CI when available and clearly distinguish CI validation from local execution.
- Prefer focused reads, diffs, and status summaries over dumping entire files unless needed for correctness.

## 5. Boundaries
- The GitHub integration's exposed actions and access may vary by session or account. Discover the available actions and verify access with a live request before concluding a capability is absent.
- Git Database Objects can create repository objects, but branch-ref permissions and repository protections still apply.
- Do not invent a successful write, test run, or verification. If a blocker remains, state what succeeded, what did not, and the next viable option.
