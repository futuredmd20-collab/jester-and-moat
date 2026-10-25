## When to cut a release

Cut a release, meaning create a `v<semver>` tag and GitHub release, when the
work on `main` behind that tag is something the user is willing to call a
publicly visible checkpoint.

In practice, on this repo, that usually means:

- a PR merged to `main`, and
- the user has said the change is worth releasing now rather than holding.

Do not assume every merge is a release. Some merges are intermediate steps,
cleanup, or work that is not worth a user-facing tag yet. In that case leave
the code on `main` but do not tag until enough has landed to be worth calling
a release.

## When to bump a version

Bump the version in the same merge that introduces the releasable change.

The version bump is not a separate later action. If a PR is worth releasing,
it should also carry the new version in the files that expose it to users and
the browser: at minimum `manifest.json` and `sw.js`, and the visible user-facing
places the repo already keeps in sync, such as `index.html`.

VERSIONING.md is explicit that the tag is the authority and that
`manifest.json` and `sw.js` are copies of the tag. Do the bump in those files
so the working tree is internally consistent before the tag is cut.

## What “releasable” means here

A change is releasable when the user has chosen to make it a checkpoint. Do not
invent a separate technical bar on top of that. The practical signal is:

- the user asked for a release, or
- the user asked for a version bump, which on this repo should be treated as
  “this change is worth a release tag as well,” or
- the user has indicated the current state of `main` should be tagged.

If the user has not indicated that, do not tag just because a merge happened.

## Pre-1.0 exception

This project is pre-1.0. That means the usual promise of semver is looser.
User-facing features can land in minor bumps. Treat 0.x y as a sequence of
usable checkpoints, not as a promise that every minor is only a feature and
every patch is only a fix.

Even so, do not tag purely mechanical changes just because they landed. If the
change is a build touch-up, a cache rename, or a doc-only note with no user-facing
meaning the user wants to preserve as a checkpoint, ask whether a tag is wanted
before cutting one.

## What a release should include

A release tag should point at a clean `main` state that the version files already
describe. The release notes are the place to say what changed, what was verified,
and what is still limited. Keep them short and concrete.

If the release includes a service-worker cache change, say so, because that affects
installed PWAs. If it includes user-visible UI, say what a user can now see or do
that they could not before.

## When main is ahead of the latest tag

If `main` has unreleasable work-in-progress after the latest tag, that is normal
pre-release state. The latest tag is still the latest release; the newer commits
on `main` are not yet a release until the user wants one.

Do not retroactively relabel the latest tag just because `main` moved on. Do not
pretend `main` is already at the next release if the user has not asked for one.

## Quick decision rule

- Merge to main? Yes.
- User said release or version bump, or clearly wants the current main tagged?
  Yes.
- Then: bump version in the same merge, then tag and release.
- Otherwise: keep the code, skip the tag until there is a reason.
