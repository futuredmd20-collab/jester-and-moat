# Vibe / Mistral — Agent Notes

Purpose: Vibe-specific quirks. Vibe follows `.agents/env-cloud.md`.

## Binary & images

- Files uploaded in chat are stored as placeholders, not bytes: text extraction of binaries fails and pixel-level image work (cropping, background removal) is impossible.
- Work with text instead: read SVG sources verbatim from GitHub and edit them without touching path data.

## Session & releases

- The sandbox resets between some calls; keep durable copies in the repo, not in the workspace.
- The GitHub integration can read tags and releases but not create them. The user cuts annotated tags and releases from a local clone (`docs/VERSIONING.md`).
