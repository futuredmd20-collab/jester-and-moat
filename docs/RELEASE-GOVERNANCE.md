# Release decisions

Defines when a change becomes a release checkpoint and the consistency rules for release metadata. Version-number meanings are in [SEMVER.md](SEMVER.md); the release procedure is in [VERSIONING.md](VERSIONING.md).

## When to release

A release is an intentional, user-facing checkpoint. Merging a PR to `main` does not automatically trigger a release or version bump. Intermediate work, documentation and changes not selected as a checkpoint may remain untagged.

When a change is chosen for release, bump the version in the same release change using [SEMVER.md](SEMVER.md). Do not bump solely because files changed or a PR merged.

## Version and cache consistency

- The annotated `v<semver>` tag is the source of truth for a release.
- In a release change, make `manifest.json` and the version component of the `sw.js` cache name agree with the tag.
- Keep the visible version label in `index.html` in sync while it is shown to players. It is display text, not an independent source of truth.
- Bump the service-worker cache suffix whenever a precached asset changes, even if there is no release or app-version bump.

Follow [VERSIONING.md](VERSIONING.md) for deployment checks, tagging, release notes and the `HISTORY.md` entry. Do not tag before the release is chosen and the version-bearing files describe it.

Keep release notes short and concrete: say what changed, what was verified and what limitations remain. Mention cache changes that affect installed PWAs, and describe user-visible changes in terms of what players can see or do.
