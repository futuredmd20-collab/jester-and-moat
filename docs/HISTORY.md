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
* Found while validating, not fixed in that commit: the dark-theme PIECE-COLOURS block has a broken comment — the BEGIN marker closes while a sentence about #605a50 is still running, so the following line starts with bare prose and the browser drops that declaration. Verified in the live page: the dark rule reports no --piece-w-body, and dark mode paints white pieces with the light-theme #e7dcbd instead of the intended #f1ebd9.

2026-10-20 — Dark-theme piece palette repaired
* The dark PIECE-COLOURS block was written with its opening comment closed by the BEGIN marker itself, leaving the sentence after it as bare CSS. The browser dropped --piece-w-body along with the junk, so dark mode fell back to the light theme's #e7dcbd.
* That fallback was measurably wrong, not merely unintended: #e7dcbd reaches 2.19:1 against the lighter dark-board square (#979590), under the 2.5:1 the palette was tuned for. The intended #f1ebd9 reaches 2.51:1, which is what the comment always claimed.
* Fixed by restoring the comment as its own block under the marker. css-tree now reports zero parse errors where it reported one, and the dark rule declares 55 custom properties instead of 54.
* Screenshot proof at 1280x900: light mode byte-identical (0 pixels changed), dark mode 16,442 pixels changed (1.29%), all inside the white pieces, max channel delta 16 of 255. The removal of the dead glyph CSS in the entry above stays byte-identical in both themes because it predates this fix.
* sw.js cache bumped to jm-cache-v0.5.5-sprite-4.
* Released as v0.5.6 (PATCH): the dark-theme piece palette now applies the intended #f1ebd9 ivory body, meeting its 2.5:1 contrast target against the board. The service worker cache was updated so installed clients receive the fix.

2026-10-20 — Flat piece art prototype added
* Added pieces-flat.svg as a hand-drawn alternative with broad, low silhouettes and reduced interior detail. It remains separate from the generator-owned classic pieces, so the original design is unchanged.
* The Options drawer now switches both gameboard and editor palette pieces between Classic and Staunton-inspired Flat prototype and remembers the choice locally. The Flat prototype is the default, including migration from older saved options that lack a preference or contain a prior prototype selection. Both sprites are embedded in the optional single-file build and precached for offline PWA use.
* This is an exploratory prototype, not a final art set; proportion and recognizability feedback is still needed.
* The later sculpted-body redraw replaces the first angular draft: smoother waist and collar forms, broader horse-head knight, taller bishop mitre with slit, and more differentiated king and queen bodies. The service-worker cache was bumped to ensure the revised sprite reaches returning preview clients.

2026-10-20 — Board style presets
* Added a separate Board style option with Soft Stone, Warm Wood and Cool Slate presets. Each adjusts square colors, frame, coordinates, highlights and moat accents independently of the page theme; dark mode has coordinated variants.
* Board-style choice is saved with existing local options. Classic pieces are the default again; Flat is retained as a selectable placeholder for future artwork. Older saved Flat prototypes migrate to Classic.
* Bumped the service-worker cache for the updated app shell.
* Bumped the app version to v0.6.0 (MINOR) for the backward-compatible board-style appearance feature; board position and saved-game formats are unchanged.

2026-10-20 — Stale palette-generator attribution dropped
* Both PIECE-COLOURS comments in style.css claimed the palette was generated by a merge script from an art/ theme stylesheet. That tooling was deleted and nothing in the repo produces the block today, so the claim pointed at a missing file and implied an edit rule that no longer applies.
* The comments now say the block is hand-maintained. The BEGIN/END markers stay: generate-piece-sprite.js refers to the PIECE-COLOURS block, and the entries above quote the markers.
* style.css is precached, so the cache name is bumped to jm-cache-v0.5.5-sprite-5. Comment-only change, so no version bump and no tag.

2026-10-21 — Flat piece art wired in
* The Flat option now renders the real flat artwork. pieces-flat.svg is regenerated by the new build-pieces-flat.js from the seven flat-*.svg crops (landed via PR #3), replacing the hand-drawn placeholder symbols; every surface using pieceMarkup — board, captured tray, promotion modal, editor palette — picks it up with no JS changes.
* Flat board sizing switched from the placeholder's stretched boxes to each crop's real aspect ratio (width = height x viewBox aspect; board squares are 1:1, so the art renders undistorted). The crops bake their own silhouette outline, so .piece.piece-set-flat { stroke: none } keeps the classic set's inherited 2.2 hairline stroke off their fill-only paths.
* The Options label "Flat (placeholder for future artwork)" became "Flat"; sw.js cache bumped to jm-cache-v0.6.0-flat-art-1; ARCHITECTURE.md now records flat-*.svg and light-*.svg as art sources that are deliberately not precached.
* The captured tray, promotion modal and editor palette now size flat pieces by true aspect (width = height x the crop's ratio, via a per-crop --flat-aspect variable) instead of the shared fixed boxes that stretched them; classic sizing on those surfaces is unchanged.

2026-10-21 — v0.6.1 released
* Version bumped to 0.6.1 for the merged flat piece art (PR #5): the Flat option renders the real artwork on the board, captured tray, promotion modal and editor palette. manifest.json and the sw.js cache name (jm-cache-v0.6.1-flat-art-1) carry the new number; index.html shows it in the title, header badge and info drawer.

2026-10-21 — AI vs AI no longer offers a side switch
* In AI vs AI the swap button and the Player Side dropdown are now disabled, with a tooltip explaining why. The swap handler also returns early in that mode. Previously the button reported "Player side switched to Black." without flipping the board, because the flip was skipped in AI vs AI.
* The game mode is now shown as a small pill next to the version badge in the header (2 Players, vs AI · Easy/Medium/Hard, AI vs AI), so it stays visible without taking up space in the info bar.
* sw.js cache bumped to jm-cache-v0.6.1-mode-pill-1 for the changed app shell.

2026-10-22 — PR workflow simplified
* AGENTS.md and PR-WORKFLOW.md: task-branch commits are now free and reversible with no separate pre-commit approval; the approval gates are opening a PR and merging. The old steps 5 and 8 (diff review, then PR-scope verification) merged into one verification pass before the PR opens.
* Agents work directly on the GitHub branch instead of local copies: the plan names the task branch, the go-ahead creates it, and every commit concentrates there — so any agent or the user can pick the work up from GitHub.
