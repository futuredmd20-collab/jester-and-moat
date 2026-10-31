# HISTORY.md — Change Log

Purpose: dated record of decisions and changes, oldest first. Use the repository for current state and HANDOVER.md for rules.

2026-10-18 — Earlier clean-up
* Reduced cross-file duplication and standardized documentation in English.

2026-10-18 — GitHub as canonical storage
* Canonical storage moved to `futuredmd20-collab/jester-and-moat`; GitHub Pages serves the app. Drive Markdown became mirrors; saved games remain in Drive and BACKUPS stays out of AI scope.
* AGENTS.md now names GitHub as canonical storage.

2026-10-18 — Agent capability notes
* Added GitHub integration constraints: sandbox Git credentials may be absent and integration access is account-scoped.

2026-10-18 — Documentation restructure
* Docs separated by purpose: AGENTS (behaviour), PROMPT (kickoff), ARCHITECTURE (deployment), HANDOVER (game rules), LIMITATIONS (constraints), RESUME (agent scratch), HISTORY (changelog).
* PWA/deployment details moved from PROMPT.md to ARCHITECTURE.md; PROMPT.md became paste-ready. RESUME.md was reset and its status notes moved here.
* Decisions use letters (A, B, …) and questions use Q-numbers after numbering schemes collided. Each doc gained a Purpose line.

2026-10-18 — Drive scope rule
* Removed stale Drive Markdown mirrors; each document has one copy in `Jester & Moat`. Agents must stay in that folder, including the actual `BACKUPS` folder, unless a tool cannot target it.
* Drive version history (Game versions, BACKUPS, and BACKUPS/Old game versions) is user-only reference; nothing outside `Jester & Moat` is project storage.

2026-10-18 — HISTORY.md moved out of the startup read
* Removed HISTORY.md from startup reading in AGENTS.md and PROMPT.md to save context; agents consult it when they need historical rationale.
* Decision followed a multi-client PROMPT.md test; results were not yet recorded and were still being gathered.

2026-10-19 — Piece art moved out of index.html
* Replaced 14 inline piece symbols with seven shared symbols in generated `pieces.svg` and `pieces.css`; `index.html` shrank from 138,441 to 13,162 bytes and `script.js` emits `<use href="#p-${name}">`.
* Added root-run `generate-piece-sprite.js` to rebuild the assets from `light-*.svg`; `sw.js` precaches them with cache `jm-cache-v0.5.5-sprite-1`, and `build.js` inlines the sprite. Work was salvaged from Freebuff (Drive: Salvage 2026-10-19) and delivered as PR #1 on `refactor/piece-sprite`.

2026-10-19 — 512 px icons restored for installability
* icon-512.png and icon-maskable-512.png added and declared in manifest.json; Chrome on Android wants a 192 and a 512 icon before it offers to install the PWA.
* Both are built from the shipping icon-192.png art, because the only 512 in history is the truncated file removed in 3fead3f and no maskable-512 ever existed. They are upscales — replace them if a true 512 source turns up.
* sw.js precaches both and bumps the cache to jm-cache-v0.5.5-sprite-2.

2026-10-19 — Sprite refactor merged and deployed
* PR #1 rebased into main (44ecd0f → 85ef78b, three commits); Pages rebuilt from 85ef78b. Post-deploy checks confirmed seven core files/assets returned 200 with correct MIME types and matching pre-merge hashes; no `http://` references remained.
* Both 512 icons remain upscales of the 192 art; replace if true 512 sources appear.

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
* PR #3 added `build-pieces-flat.js`, which generates `pieces-flat.svg` from seven `flat-*.svg` crops; all `pieceMarkup` surfaces (board, captured tray, promotion modal, editor palette) now use the real art without JS changes.
* Flat pieces preserve each crop's aspect ratio, including in trays/modals/palette via `--flat-aspect`; their baked outlines avoid the classic set's inherited stroke. The option label became “Flat”, cache became `jm-cache-v0.6.0-flat-art-1`, and ARCHITECTURE.md identifies source SVGs as deliberately not precached.

2026-10-21 — v0.6.1 released
* Version bumped to 0.6.1 for the merged flat piece art (PR #5): the Flat option renders the real artwork on the board, captured tray, promotion modal and editor palette. manifest.json and the sw.js cache name (jm-cache-v0.6.1-flat-art-1) carry the new number; index.html shows it in the title, header badge and info drawer.

2026-10-21 — AI vs AI no longer offers a side switch
* In AI vs AI the swap button and the Player Side dropdown are now disabled, with a tooltip explaining why. The swap handler also returns early in that mode. Previously the button reported "Player side switched to Black." without flipping the board, because the flip was skipped in AI vs AI.
* The game mode is now shown as a small pill next to the version badge in the header (2 Players, vs AI · Easy/Medium/Hard, AI vs AI), so it stays visible without taking up space in the info bar.
* sw.js cache bumped to jm-cache-v0.6.1-mode-pill-1 for the changed app shell.

2026-10-22 — PR workflow simplified
* AGENTS.md and PR-WORKFLOW.md: task-branch commits are now free and reversible with no separate pre-commit approval; the approval gates are opening a PR and merging. The old steps 5 and 8 (diff review, then PR-scope verification) merged into one verification pass before the PR opens.
* Agents work directly on the GitHub branch instead of local copies: the plan names the task branch, the go-ahead creates it, and every commit concentrates there — so any agent or the user can pick the work up from GitHub.
* An agent whose environment supports it may keep a local clone as a working copy (faster reads, verify-before-publish editing), but only after asking the user and getting approval; the clone is a cache, and the work lands on the task branch before any PR.

2026-10-22 — Piece accent cache bump
* The piece-colour improvements (black outlines, dark accent, flat jester, black bishop/rook; main commit 9f0b31f) shipped without a cache suffix bump. style.css is precached, so the cache name is bumped to jm-cache-v0.6.1-piece-art-1 to reach returning clients. No version bump and no tag.

2026-10-25 — Release and version guidance aligned
* Aligned RELEASE-GOVERNANCE.md, SEMVER.md and VERSIONING.md: tagging is an explicit checkpoint; `manifest.json`, the `sw.js` version component, and any visible `index.html` label must match. Precaching changes need a cache-suffix bump even without an app-version bump.
* Defined MAJOR for incompatible save/storage formats, MINOR for backward-compatible features, and PATCH for fixes/internal changes preserving saves and features; added Purpose lines.

2026-10-26 — Agent guidance consolidated
* Shared limitations guidance now lives in .agents/limitations.md; removed duplicate docs/LIMITATIONS.md.
* Updated AGENTS.md guidance and corrected docs/RESUME.md's active limitations reference.


2026-10-27 — Engine-plugin plan reconciled with merged work
* Reconciled ENGINE-PLUGINS.md with repository changes from PRs #12, #16, #18 and #20–#24: registry, MinMax adapter, MCTS, side/phase controls, loading and precache.
* Separated source changes from runtime evidence. The audit found worker dispatch still called `getBestMove` unconditionally; MCTS dispatch, reload persistence, phase boundaries, regressions and strength calibration remained unverified. No runtime tests were run.

2026-10-27 — Engine worker dispatch fix
* Updated the generated AI worker to dispatch `workerFn` to `mctsGetMove` or `getBestMove`; unknown selectors now return an explicit error. Refreshed MCTS integration comments and ENGINE-PLUGINS.md.
* Static source review only—no browser tests, build, dependency installation or runtime execution.

2026-10-27 — Engine startup and single-file build hardening
* Fixed the single-file builder to embed MCTS before `script.js`; the omission could prevent board initialization. MCTS registration and worker-helper serialization are now conditional on module availability, and load failure logs a warning while preserving the board/MinMax fallback.
* Bumped cache to `jm-cache-v0.7.2-engine-startup-1`. Static source review only; no build or browser/runtime verification.


2026-10-30 — Version metadata synchronized with v0.8.0
* Corrected the visible app version in `index.html` and the `manifest.json` version to match the existing `v0.8.0` release tag.
* Updated the service-worker cache identifier to `jm-cache-v0.8.0-compact-ui-14` so installed clients fetch the corrected app shell. The existing tag and published release remain unchanged.


2026-10-30 — AI worker runtime-error recovery
* A worker runtime error now terminates the failed worker, invalidates late responses, and retries the active engine request once on the main thread using the captured position and selected engine.
* Added a contract test for runtime-error fallback and updated the engine verification notes. CI contract tests passed; live-browser behavior remains unverified.

2026-10-30 — Manual engine browser verification checklist
* Added a concrete browser checklist for engine dispatch, side/phase configuration, reload persistence, MCTS load failure, worker fallback/runtime errors, and offline service-worker behavior. These checks remain outstanding until observed in a real browser.

2026-10-30 — Development-only debugging and preview guidance
* Documented Eruda as non-`main` development tooling that must be removed before a PR to `main`, and kept separate from the existing `?debug=1` logger and service-worker cache.
* Clarified that agents should prefer existing branch-based Pages or preview workflows over proposing custom test pages by default.

2026-10-30 — Opt-in Eruda debugging wired and verified
* Added the local Eruda v3.4.3 bundle and a loader enabled only by `?eruda=true`; the existing `?debug=1` logger is unchanged. Eruda is not in the service-worker precache, and `build.js` strips its loader include from the self-contained build.
* Added contract tests for opt-in loading, initialization, load failure, and build/precache exclusions. GitHub Actions contract tests passed (45 tests, 0 failures).
* The user tested the branch preview and confirmed Eruda works; when `?debug=1` is active, its logger output appeared in the Eruda console.

2026-10-30 — Eruda release policy clarified
* Eruda may remain in `main` and release source snapshots as opt-in debugging tooling. The CI rule that rejected Eruda on PRs to `main` was removed; automated tests continue to protect the service-worker precache and single-file build exclusions.

2026-10-31 — Planning index replaces session scratch
* Added root `PLANS.md` as a concise index to topic-specific work plans, with scope notes so agents can choose the right plan without reading all of them. The index distinguishes plans from reference/procedure documents and reminds agents to verify repository state.
* Removed stale `docs/RESUME.md`; its session notes described an outdated state and its relevant engine work is already covered by `docs/ENGINE-PLUGINS.md`. Updated agent guidance and HANDOVER's purpose statement to remove the resume-file workflow.

2026-10-31 — Undo/redo and save/load consistency
* Track a move-log snapshot alongside each history state so undo/redo restores complete logs, including moat-destruction notices, and preserves the next moat-placement phase and turn.
* Restore terminal-game status on redo and in exported saves. Validate imported board, piece, clock, phase, and history-log structures while keeping legacy saves without per-history log snapshots importable.
* Added regression tests for history transitions, terminal status, JSON roundtrips, malformed saves, and legacy compatibility. GitHub Actions contract tests passed (51 tests, 0 failures).


2026-10-31 — Save/import consistency rules and regression coverage
* Defined the compatibility boundary for save imports: absent legacy fields receive defaults, but explicitly malformed values are rejected.
* Added consistency checks between the current state and latest history snapshot (allowing current clocks to be newer), and between the current move log and latest history-log snapshot.
* Added focused tests and an indexed plan. GitHub Actions passed the complete contract suite (56 tests, 0 failures) on commit `6191f3c`; real-browser verification remains outstanding.

2026-10-31 — Browser verification of save/import and undo/redo
* The user tested the current task branch through GitHub Pages. Save/reload or import, undo/redo and clocks, moat transitions, and rejection of malformed saves without disturbing the active game all passed.
* Recorded as manual browser verification, separate from the 56-test GitHub Actions result on commit `6191f3c`. No game code changed for this verification.


2026-10-31 — Engine Plugins browser verification completed
* The user concluded the current Engine Plugins test pass. Manual play exercised MinMax and MCTS without visible errors; White/Black configuration independence and restoration after ordinary reload were confirmed while the browser cache remained intact.
* The full game log showed phase-specific engine selection and matching worker dispatch. In the second game, White used MCTS in opening, both sides used MinMax in midgame, and Black used MCTS in endgame. The game ended by checkmate at ply 79; no obvious engine/worker errors appeared in the reviewed log.
* Persistence after cache clearing, MCTS load failure, worker-construction/runtime recovery, offline behavior, strength calibration, and additional special-case regressions remain unverified or future work. The user chose to stop testing for now.
* No game code changed for this verification.
