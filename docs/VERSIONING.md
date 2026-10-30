# Releases, tags and version numbers

This document is the operational procedure for cutting and publishing releases. Version-number meanings are in [SEMVER.md](SEMVER.md); release-choice and consistency rules are in [RELEASE-GOVERNANCE.md](RELEASE-GOVERNANCE.md). `HISTORY.md` is the narrative record of what shipped; `ARCHITECTURE.md` describes how the app is built.

## Repository and version history

- The repository is the whole project; there is no release branch to maintain and no Drive copy to synchronize.
- `main` is the deployable branch served by GitHub Pages. Work lands through short-lived branches and pull requests; delete the branch afterwards.
- Drive `BACKUPS` contains the user's saved release ZIPs, not a working project copy.
- A version is an annotated tag on one commit. Tags record a fixed version; branches are moving pointers and must not be used as version records.
- GitHub makes each tag browsable (for example `tree/v0.5.5`) and lists tags and releases; a branch per version is unnecessary.

## Version-bearing files

The annotated tag is authoritative. Keep these copies aligned with the released version:

- `manifest.json` — the `version` field. This field is non-standard and browsers ignore it; it is retained for easy inspection.
- `sw.js` — the version component in the cache name, `jm-cache-v<version>-<suffix>`.
- `index.html` — keep the visible version label in sync while it is shown to players.

The cache suffix is distinct from the app version. If a precached asset changes without a version bump, still increment the suffix (for example, `-sprite-3`) so installed clients retire the old app shell.

## Development-only tools and release boundary

Eruda is temporary development tooling, not a shipped app feature. It may be added to a non-`main` branch for mobile browser debugging, but must not be merged into `main` or included in a release tag/source snapshot. Before opening a PR to `main`, remove `scripts/eruda.js`, the branch-only loader, its `index.html` include, and any related development-only wiring. A URL parameter check or omission from the service-worker precache does not keep files out of a release snapshot.

Keep Eruda out of `sw.js`'s precache and out of the optional single-file build. Use `?eruda=true` for Eruda; preserve the existing `?debug=1` behavior. When the Eruda development branch is no longer needed, remove it after the work is merged or abandoned.

## Release procedure

1. Land the chosen release change on `main` and let GitHub Pages rebuild.
2. Manually fetch the live files you changed. Check for HTTP 200 and the expected MIME type, then compare hashes with the local copies. There is no CI doing this for the project.
3. Confirm that `manifest.json` and `sw.js` carry the same X.Y.Z version, and that the visible label is current if present.
4. Tag the deployed commit and push only the tag.
5. Publish the release with a short summary and known limitations. Avoid automatically generated notes for a first release because they include every commit since the beginning.
6. Add a dated entry to `HISTORY.md`.
7. Download the ZIP for that tag once and keep it in Drive `BACKUPS`.

## Immutable releases

Repository release immutability was enabled on 2026-10-20. A published release's tag and uploaded assets are locked against silent repointing. Release notes can still be edited (verified on v0.5.5). Fix released code with a new version; never move the old tag.

## Backups

Keep one user-made ZIP per release in Drive `BACKUPS`. GitHub's automatically generated source ZIPs are regenerated on request, so they are not the archival copy. Downloading and uploading the backup are the user's responsibility and remain outside agent scope.

## Automation considered, not adopted

Release Please derives version bumps and changelogs from Conventional Commits (`feat:`, `fix:`, `refactor:`). It is not adopted because `HISTORY.md` is the narrative record and generating a second changelog risks disagreement. Reconsider if releases become frequent enough that the manual procedure is often skipped.
