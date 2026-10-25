# SEMVER.md — Version Number Meanings
Purpose: defines what MAJOR, MINOR, and PATCH mean for this project. Not for deciding whether to release (RELEASE-GOVERNANCE.md) or the release procedure (VERSIONING.md).

## Version shape

The project uses three-part versions: `MAJOR.MINOR.PATCH`. The annotated Git tag is the authoritative version; `manifest.json` and the service-worker cache name carry matching copies, as described in `VERSIONING.md`.

## What each part means here

- **MAJOR** — a saved-game or storage format written by an older build no longer loads.
- **MINOR** — a new feature that remains backward compatible.
- **PATCH** — a fix or internal change that keeps saves and existing features working as before.

## Choosing a version

Choose the bump based on compatibility and user-visible effect, not the number of files or lines changed. Use the smallest number change that accurately describes the release under the definitions above.

A merge is not automatically a release or version bump. Decide whether the change is a release checkpoint first; see `RELEASE-GOVERNANCE.md`. Changes to precached assets still need a service-worker cache-suffix bump so existing PWA installs receive them, whether or not the app version changes; see `VERSIONING.md`.
