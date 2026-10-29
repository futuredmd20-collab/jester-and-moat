# Version number meanings

Defines what MAJOR, MINOR and PATCH mean for this project. Release decisions belong in [RELEASE-GOVERNANCE.md](RELEASE-GOVERNANCE.md); the release procedure is in [VERSIONING.md](VERSIONING.md).

Use three-part versions: `MAJOR.MINOR.PATCH`.

- **MAJOR** — a saved-game or storage format written by an older build no longer loads.
- **MINOR** — a new, backward-compatible feature.
- **PATCH** — a fix or internal change that preserves existing saves and features.

Choose the smallest bump that accurately reflects compatibility and user-visible effect, not the number of files or lines changed. A merge is not automatically a release or version bump.

The annotated `v<semver>` Git tag is authoritative; `manifest.json` and the version component of the `sw.js` cache name mirror it. A service-worker cache-suffix bump is separate from the app version: precached asset changes require one even when the app version stays the same. See [VERSIONING.md](VERSIONING.md) for details.
