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

2026-10-18 — HISTORY.md moved out of the startup read
* HISTORY.md dropped from the session-start reading order in AGENTS.md and from the kickoff prompt in PROMPT.md: it is a changelog that only grows, so reading it up front costs every new session context before any work begins.
* It is now background: agents open it when they need to know why something is the way it is.
* Decided after a multi-client test of PROMPT.md. The test results themselves are not recorded yet; the user is still gathering them.

2026-10-19 — Piece art moved out of index.html
* The fourteen inline piece symbols became seven shared symbols in generated pieces.svg, with the side palette in pieces.css; index.html fell 138,441 → 13,162 bytes and script.js now emits `<use href="#p-${name}">`.
* generate-piece-sprite.js added: it rebuilds pieces.svg and pieces.css from the light-*.svg files and must be run from the repo root. sw.js precaches both and bumps the cache to jm-cache-v0.5.5-sprite-1; build.js inlines the sprite for the single-file build.
* Salvaged from a Freebuff chat that could not be migrated (Drive: Salvage 2026-10-19) and delivered as PR #1 on branch refactor/piece-sprite.

2026-10-19 — 512 px icons restored for installability
* icon-512.png and icon-maskable-512.png added and declared in manifest.json; Chrome on Android wants a 192 and a 512 icon before it offers to install the PWA.
* Both are built from the shipping icon-192.png art, because the only 512 in history is the truncated file removed in 3fead3f and no maskable-512 ever existed. They are upscales — replace them if a true 512 source turns up.
* sw.js precaches both and bumps the cache to jm-cache-v0.5.5-sprite-2.

2026-10-19 — Sprite refactor merged and deployed
* PR #1 merged into main by rebase (44ecd0f → 85ef78b, three commits); GitHub Pages rebuilt on 85ef78b and now serves the sprite build.
* Post-deploy check: index.html, script.js, pieces.css, pieces.svg, manifest.json, sw.js and both 512 icons return 200 with correct MIME types and match their pre-merge hashes; no http:// references remain.
* The two 512 icons are still upscales of the 192 art — replace them if a true 512 source turns up.

2026-10-20 — Tagged releases, and the end of the Drive mirrors
* v0.5.5 tagged at fbbffef and published as the first GitHub Release; the repo's Immutable Releases setting was enabled, so the tag and its assets are locked.
* Drive .md mirrors retired: GitHub is now the only editable copy of the docs. Drive keeps saved games and user-made ZIP backups in BACKUPS, one ZIP per release. AGENTS.md lost the sync rule, PROMPT.md no longer mentions Drive copies.
* docs/VERSIONING.md added: versions are annotated tags on main, not branches, because a branch moves and cannot record a version. It also fixes what MAJOR/MINOR/PATCH mean here and lists the seven release steps, since nothing is automated.
* Automation considered and not adopted: Release Please would duplicate HISTORY.md as a second changelog.

2026-10-20 — Legacy glyph CSS removed
* style.css lost the four dead .piece-glyph rules (base, .white, .black and the dark-theme colour override), 47 lines. Nothing has emitted that class since the Unicode-glyph renderer retired in v0.5.1.
* The old comment claimed the archived gallery piece-contours.html was built from style.css. Checked: that file is a standalone 335 KB HTML with its own inline copy of the rules, so it does not read the stylesheet and loses nothing.
* Verified rather than assumed: headless Chromium at 1280x900, HEAD against this commit, screenshots byte-identical in light and dark (0 changed pixels per theme); CSS rule count 169 to 165, the four removed selectors being the only difference.
* style.css is precached, so the cache name is bumped to jm-cache-v0.5.5-sprite-3. No user-visible change, so no version bump and no tag.
* Found while validating, not fixed: the dark-theme PIECE-COLOURS block has a broken comment (the BEGIN marker closes on line 621, and line 622 starts mid-sentence with "#605a50: an ivory body..."), so the browser drops --piece-w-body and dark mode paints white pieces with the light-theme #e7dcbd instead of the intended #f1ebd9.
