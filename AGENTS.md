AGENTS.md — Jester & Moat: House Rules & Entry Point
Purpose: how agents behave in this project. Read this file first in every session; it is the canonical entry point.

Wait for My Go
* Plan first: state what you'll do and why in a few lines, then stop and wait.
* Never start builds, installs, downloads, uploads, or multi-step work before I say go.
* A question is not approval. Reading, searching, and planning are always fine.
* After I approve, finish that one step and report — don't chain into the next.

Branch & Review
* Create a dedicated branch for every task: propose the branch in the plan, create it on approval, and concentrate every commit there. GitHub is the shared workspace — do not keep a local copy as the working state, so any agent or the user can pick the work up from the branch.
* A local clone may be used as a working copy when the environment supports it — faster reads and verify-before-publish editing — but only after asking you and getting your explicit approval. The clone is a cache, never the source of truth: the work lands on the task branch before any PR.
* Branch commits are free and reversible; the approval gates are opening a PR and merging. Show the diff before a PR, not before each commit.
* Never merge a PR without explicit permission.
* Treat GitHub as canonical; do not modify mirror copies as a substitute.

Keep Replies Short
* Default: 15 lines max, plain English, no preamble, no restating my question.
* Lead with the answer or recommendation; justify only if I ask.
* End every turn with a lettered list of decisions I need to make (A, B, …), or "no decisions needed". Numbers are reserved for questions (Q1, Q2, …).

References & Documentation Map
* Every doc opens with a Purpose line stating what it holds and what it does not. Keep that line accurate when you edit a file.
* VERSIONING.md: how a release is cut. Not part of the startup read — open it when tagging.
* HANDOVER.md: game rules and development policy.
* ARCHITECTURE.md: deployment model and PWA requirements.
* .agents/limitations.md: platform and agent capability records. If you cannot perform an action, update your record or ask the user to do it.
* HISTORY.md: dated record of decisions and changes. Background only — not part of the startup read.
* PROMPT.md: the kickoff prompt to paste into a new session.
* RESUME.md: agent-only scratch. Never treat its contents as project truth.

Session Start
* Read AGENTS.md, then HANDOVER.md, ARCHITECTURE.md, and .agents/limitations.md, in that order.
* HISTORY.md is not in the startup read: it is a changelog and grows without limit. Open it when you need to know why something is the way it is, not before starting work.
* RESUME.md is not on the reading list either: it holds another agent's leftovers, not project fact. Open it only when resuming an interrupted session.

AI Work Scope
* AI agents may work with project files and folders generally. Only the **BACKUPS** folder and everything inside it are out of scope.
* In Google Drive, work only inside the **Jester & Moat** folder. Creating files elsewhere in Drive, including My Drive root, is allowed only when a tool cannot target that folder, and you must say so when it happens. Nothing outside Jester & Moat is ours to touch without the user asking for it specifically.

Markdown File Integrity
* Files ending in .md must remain actual Markdown/plain-text files in Google Drive, not Google Docs or Word documents.
* When creating or editing an .md file, use a method that preserves its text/markdown MIME type; do not convert it into a Google Workspace document.
* After creating or editing an .md file, verify its MIME type is text/markdown. If the available tool cannot preserve or confirm that type, stop and ask the user rather than converting it.

Canonical Storage
* GitHub is canonical: the public repo futuredmd20-collab/jester-and-moat (docs/ folder) is the single source of truth. There is no second copy to keep in sync.
* Drive holds no .md mirrors. Drive keeps saved games and the user's own ZIP backups in **BACKUPS**; agents do not maintain doc copies there.
* Version history lives in git as annotated tags and GitHub Releases, not as one branch per version. See VERSIONING.md.
* If the user asks for a doc copy outside the repo, treat it as a one-off export and say it will go stale.
* Never overwrite a Drive original without asking first.
