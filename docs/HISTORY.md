HISTORY.md — Change Log
Purpose: dated record of decisions and changes, newest last. Not for current state (the repo shows that) or rules (HANDOVER.md).

2026-10-18 — Earlier clean-up
* Project structure cleaned up to remove cross-file redundancy across the .md files.
* Documentation standardized in English across all docs.

2026-10-18 — GitHub as canonical storage
* Canonical project storage moved to the public repo futuredmd20-collab/jester-and-moat (docs/ folder); GitHub Pages at https://futuredmd20-collab.github.io/jester-and-moat/.
* Drive .md files became mirrors. Saved games stay in Drive only; the Backups folder remains out of AI scope.
* AGENTS.md gained a Canonical Storage section; the older "Google Drive is canonical" wording was removed.

2026-10-18 — Agent capability notes
* LIMITATIONS.md gained a GitHub section: this sandbox has no git credentials, so writes go through the GitHub integration; the integration is account-scoped, so no per-session login is needed.

2026-10-18 — Documentation restructure
* Docs split by purpose rather than by which agent requested them: AGENTS.md (behaviour), PROMPT.md (kickoff prompt), ARCHITECTURE.md (deployment), HANDOVER.md (game rules), LIMITATIONS.md (constraints), RESUME.md (agent scratch), HISTORY.md (this file).
* The PWA and deployment spec moved out of PROMPT.md into ARCHITECTURE.md; PROMPT.md is now an actual paste-ready prompt.
* RESUME.md reset to a blank agent-scratch template; its status notes moved here.
* Decisions are now lettered (A, B, …) and numbers reserved for questions (Q1, Q2, …), after two numbering schemes collided in one reply.
* Every doc now opens with a Purpose line saying what it holds and what it does not.

2026-10-18 — Drive scope rule
* Drive cleaned of stale .md mirrors; each doc now exists once, in the Jester & Moat folder.
* AGENTS.md work scope corrected to the real folder name **BACKUPS**, and agents are now told to stay inside the Jester & Moat folder. Creating files elsewhere in Drive is allowed only when a tool cannot target that folder.
* Drive version history confirmed as user-only reference: Game versions, BACKUPS, and BACKUPS/Old game versions. Nothing outside Jester & Moat is project storage.
