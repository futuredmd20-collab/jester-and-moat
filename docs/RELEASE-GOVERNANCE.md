# RELEASE-GOVERNANCE.md — Release Decisions
Purpose: when to make a release checkpoint and how its version files stay aligned. Not for the project’s version-number definitions (SEMVER.md) or the full release procedure (VERSIONING.md).

## When to release

A release is an intentional, user-facing checkpoint. A PR merge to `main` does not automatically mean a release or version bump; intermediate work, documentation, and changes not selected as a checkpoint can remain untagged.

Choose whether a change is worth releasing. When it is, bump the version in the same release change, using the project’s established rules in `SEMVER.md`. Do not create a version bump merely because files changed or a PR merged.

## Version and cache consistency

The annotated `v<semver>` tag is the authority for a release. In the release change, make the version in `manifest.json` and the version component of the `sw.js` cache name agree with that tag. Keep the visible version label in `index.html` in sync while it is shown to players; it is display text, not a separate source of version truth.

A service-worker cache suffix is separate from the app version. Whenever a precached asset changes, bump the `sw.js` cache suffix so installed clients receive the changed app shell, even when the change is not being released and the app version is unchanged.

## Release procedure

Follow `VERSIONING.md` for the release sequence, deployment checks, tagging, release notes, and HISTORY.md entry. Do not tag a commit before the release has been chosen and the version-bearing files describe it.

Keep release notes short and concrete: explain what changed, what was verified, and any remaining limitations. Mention service-worker cache changes because they affect installed PWAs, and describe user-visible changes in terms of what players can now see or do.
