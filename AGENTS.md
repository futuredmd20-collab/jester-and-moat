# AGENTS.md — Jester & Moat: House Rules & Entry Point

Purpose: how agents behave in this project, including execution, approval, repository workflow, and documentation boundaries. This is the canonical entry point; project-specific game rules and architecture are documented elsewhere.

## Intent & Execution
- Interpret messages in the context of the full conversation, established decisions, and approved plans; prefer intended meaning over isolated literal readings.
- Discussion, questions, hypotheticals, and suggestions are not authorization to act.
- File changes require clear action intent, expressed explicitly or established unambiguously by context. No specific command word is required.
- For multi-step work, present a concise plan and wait for approval before execution.
- Approval covers the stated plan and its logically dependent steps.
- Once approved, complete the plan's dependent steps without repeated approval, staying within the agreed scope. Do not extend approval to unrelated work or materially different actions.
- Ask only when materially different interpretations could lead to a consequential unwanted action. Resolve apparent conflicts using context and instruction priority before asking.
- Reading, searching, and planning are always allowed. Explicit safeguards elsewhere still apply.

## Planning & Approval
- Before starting multi-step work, summarize the intended changes and execution steps.
- Identify the intended scope, relevant files, workflow, and expected outcome.
- Wait for approval of the plan before executing it.
- If new information requires a material change to the approved plan, explain the change and seek approval before proceeding.
- Do not ask for approval again for steps logically required by the approved plan and remaining within its scope.
- A task limited to answering a question, reading files, searching, or proposing a plan does not authorize repository modifications.
- Approval applies only to the stated plan and its dependent steps. It does not authorize unrelated work or materially different actions.

## Startup Context
Before making changes to the project:
1. Read `AGENTS.md`.
2. Read `docs/HANDOVER.md`.
3. Read `docs/ARCHITECTURE.md`.
4. Read `.agents/limitations.md`.
Use these documents to understand the current state, architecture, constraints, and outstanding work before planning changes.

## Repository Scope
- GitHub is the source of truth for repository state and project changes.
- Do not treat files in `BACKUPS/` as authoritative project files or modify them as part of ordinary project work.
- Keep changes focused on the files and objectives included in the approved plan.
- Do not introduce unrelated cleanup, refactoring, or formatting changes.
- Treat GitHub as canonical; do not modify mirror copies as a substitute for updating the repository.

## Branch & Review
- Every task involving repository changes must use its own dedicated branch.
- Do not make project changes directly on the default branch.
- Include the proposed branch in the plan. Create it after the plan is approved.
- Before editing, confirm the intended working branch and repository state.
- Concentrate all commits for the task on its dedicated branch.
- GitHub is the shared workspace so the user or another agent can continue work from the branch.
- A local clone may be used as a working copy when the environment supports it, but only after asking the user and receiving explicit approval. A local clone is a cache, never the source of truth; the work must land on the task branch before any PR.
- Branch commits are free and reversible; they do not require separate approval when covered by the approved plan.
- Review the resulting diff before committing or publishing changes, as appropriate to the selected workflow.
- Show the diff to the user before creating a pull request.
- Never open a PR without explicit permission. Approval of a plan that explicitly includes opening a draft PR counts as that permission.
- Never merge a pull request unless the user explicitly authorizes the merge.
- Permission to edit, commit, or push is not permission to open or merge a PR unless that action was explicitly included in the approved plan.

## Workflow Options
When a change is requested, use the established workflow choice if one is clear. Otherwise, ask which workflow the user wants:
- **A. Local commit only** — make the approved changes and commit them locally; do not push or make remote changes.
- **B. Commit and push to an existing branch** — make the approved changes, commit them, and push them to the specified existing remote branch.
- **C. Create a branch, commit, and push** — create a dedicated branch from `main`, make the approved changes, commit them, and push the branch.
- **D. Full workflow** — create a dedicated branch from `main`, make the approved changes, commit and push, review the diff, and open a draft PR after showing the diff to the user.
- **E. Custom workflow** — follow the specific sequence agreed with the user.
Use the selected workflow consistently. Do not silently substitute a different workflow if the selected one cannot be completed. Explain the limitation and ask how to proceed when necessary.

## Changes & Verification
- Make only changes covered by the approved plan.
- Preserve existing content and conventions unless the approved task requires changing them.
- Verify the resulting repository state after changes where the available tools permit it.
- Do not claim that a change, commit, push, or pull request succeeded until the relevant operation has actually succeeded.
- If a tool or integration returns an error, report the error accurately. Do not claim the requested operation completed.
- If the available integration cannot perform an operation, explain the limitation and offer a viable alternative rather than repeatedly attempting the same failed operation.
- Do not bypass repository permissions, branch protections, or other access controls.

## Builds, Installs & External Operations
- Do not run builds, install dependencies, download files, or upload files unless the user has explicitly authorized the operation.
- Explain when one of these operations is necessary and obtain permission before performing it.
- Approval of a code or documentation change does not automatically authorize unrelated builds, installations, downloads, or uploads.
- If one of these operations is a necessary step in an approved plan, ensure it is included in the plan's scope before performing it.

## References & Documentation Map
- Every documentation file begins with an accurate Purpose line stating what it holds and what it does not. Keep that line accurate when editing a file.
- `docs/VERSIONING.md`: how a release is cut. Open it when preparing a release or tagging; it is not part of the startup read.
- `docs/HANDOVER.md`: game rules and development policy.
- `docs/ARCHITECTURE.md`: deployment model and PWA requirements.
- `.agents/limitations.md`: shared boundaries and agent capability records. If you cannot perform an action, update the appropriate record or ask the user to do it.
- `docs/HISTORY.md`: dated record of decisions and changes. It provides background, not current state or rules, and is not part of the startup read.
- `docs/PROMPT.md`: the kickoff prompt to paste into a new session.
- `docs/RESUME.md`: agent-only scratch. Never treat its contents as project truth; read it only when resuming interrupted work.
- Agent-specific capability notes live in `.agents/freebuff.md`, `.agents/vibe.md`, and `.agents/gemini.md`.

## AI Work Scope
- AI agents may work with project files and folders generally. Only the `BACKUPS/` folder and everything inside it are out of scope.
- In Google Drive, work only inside the `Jester & Moat` folder.
- Creating files elsewhere in Drive, including the My Drive root, is allowed only when a tool cannot target the project folder; disclose when this happens.
- Nothing outside `Jester & Moat` is project material to touch without the user specifically asking for it.

## Markdown File Integrity
- Files ending in `.md` must remain actual Markdown/plain-text files in Google Drive, not Google Docs or Word documents.
- When creating or editing an `.md` file in Drive, use a method that preserves its `text/markdown` MIME type; do not convert it into a Google Workspace document.
- After creating or editing an `.md` file in Drive, verify its MIME type is `text/markdown`.
- If the available tool cannot preserve or confirm that type, stop and ask the user rather than converting the file.

## Canonical Storage
- GitHub is canonical: the public repository `futuredmd20-collab/jester-and-moat` is the single source of truth for project files and documentation.
- Drive has no Markdown mirrors to maintain. Drive holds saved games and the user's own ZIP backups in `BACKUPS/`; agents do not maintain documentation copies there.
- Version history lives in Git as annotated tags and GitHub Releases, not as one branch per version. See `docs/VERSIONING.md`.
- If the user asks for a documentation copy outside the repository, treat it as a one-off export and explain that it will become stale.
- Never overwrite a Drive original without asking first.

## Communication
- Keep plans, status updates, and explanations concise and specific.
- Default to 15 lines or fewer, in plain English, without unnecessary preamble or restating the user's question.
- Allow up to 20–25 additional lines when needed to explain a decision, caveat, or context clearly and avoid misinterpretation.
- Lead with the answer or recommendation; justify it only as needed.
- Distinguish clearly between proposed, approved, in-progress, and completed work.
- When reporting completion, summarize the changes and provide relevant branch, commit, diff, or PR references where available.
- If blocked, state what was attempted, the actual result, and the next viable option.
- Avoid unnecessary clarification questions when the user's intent is clear from the conversation and approved plan.
- Determine whether the user needs to make a decision or provide input before concluding a response.
- When no decision or input is needed, end naturally without a decision list or a "no decisions needed" statement.
- When the user must choose between two or more alternatives, present the alternatives in an ordered, lettered list (A, B, C, …) and clearly state what decision is needed.
- When only one viable alternative exists, explain the recommendation or next step directly without a decision list.
- When one option is preferable but the user still needs to choose, identify the recommendation and briefly explain why, while presenting the alternatives.
- Distinguish actual decisions from completed actions, status updates, blockers, and recommendations. Never manufacture decisions to satisfy a formatting rule.
- Prioritize clear, natural, and accurate communication over mechanical formatting. Do not add headings, lists, summaries, or closing statements solely to satisfy a template.
- Scale the response to the task: keep ordinary conversation conversational and provide an appropriate status summary for multi-step work.
- When a user corrects a recurring behavior, address the underlying instruction or process where possible rather than merely acknowledging the correction.
