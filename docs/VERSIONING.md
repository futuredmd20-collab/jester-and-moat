VERSIONING.md — Releases, Tags & Version Numbers
Purpose: how a version is cut, tagged and published. Not for what shipped (HISTORY.md) or how the app is built (ARCHITECTURE.md).

## One source of truth
* The repo is the whole project: there is no release branch to keep in step and no Drive copy to update.
* main is always deployable and is what GitHub Pages serves. Work happens on short-lived branches, merges by pull request, and the branch is deleted afterwards.
* Drive holds saved games and the user's own ZIP backups in **BACKUPS** — nothing that has to stay in sync.

## A version is a tag, not a branch
* A version is an annotated tag on one commit: `git tag -a v0.6.0 -m "..."`. It points at that commit forever.
* A branch is a moving pointer. Pushing to a branch named `v0.6.0` changes what that name means, so it cannot record a version; branches are for work in progress.
* GitHub already provides the version history a branch-per-version would imitate: every tag is browsable at `tree/v0.5.5`, listed at `tags`, and described at `releases`.

## What the numbers mean (SemVer)
* MAJOR — a saved game or storage format written by an older build no longer loads.
* MINOR — a new feature, backward compatible.
* PATCH — a fix or internal change that keeps saves and features as they were.
* Not every merge is a version. Docs, cache suffixes and refactors that ship no user-visible change go to main untagged.

## Where the number is written
* Two files carry it and must agree: `manifest.json` (`"version"`) and the cache name in `sw.js` (`jm-cache-v<version>-<suffix>`).
* The tag is the authority; those two are copies. `manifest.json`'s version field is non-standard and browsers ignore it — it exists to be grepped.
* Asset changes that ship without a version bump still bump the cache suffix (`-sprite-3`, …), so installed phones retire the old shell.

## Cutting a release
1. Land the work on main and let Pages rebuild.
2. Check by hand: fetch the live files you touched, confirm 200 plus the expected MIME type, and compare hashes with the local copy. There is no CI to do it.
3. Confirm `manifest.json` and `sw.js` carry the same X.Y.Z.
4. Tag the deployed commit, then push only the tag: `git tag -a vX.Y.Z -m "..."` and `git push origin vX.Y.Z`.
5. Create the release: `gh release create vX.Y.Z --notes-file notes.md`, with a short summary and the known limits. Do not use `--generate-notes` for a first release; it dumps every commit since the beginning.
6. Add the dated entry to HISTORY.md.
7. Download the tag's ZIP once and keep it in Drive **BACKUPS**.

## Immutable Releases
* Enabled on this repo on 2026-10-20, so a published release's tag and uploaded assets are locked and cannot be silently repointed at other code.
* Editing the release notes after publication still works (verified on v0.5.5). Fixing code that was released needs a new version, not a moved tag.

## Backups
* One user-made ZIP per release in BACKUPS. GitHub's auto source zips are regenerated on request, so the copy you keep is the archive, not GitHub's.
* BACKUPS stays out of agent scope; the download and upload are the user's.

## Automation (considered, not adopted)
* Release Please derives the bump and the changelog from Conventional Commits (`feat:`, `fix:`, `refactor:`). It earns its keep when the changelog should be generated from commit messages.
* It is not adopted here: HISTORY.md is the narrative record, and running both produces two changelogs that disagree. Revisit if releases become frequent enough that the seven steps above get skipped.
