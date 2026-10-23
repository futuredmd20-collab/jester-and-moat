## Version shape

This project uses three-part semver: `MAJOR.MINOR.PATCH`.

Since it is pre-1.0, read the triple as a sequence of usable checkpoints rather
than as a strict API-compatibility promise.

## What each part means here

- `PATCH` — the release is best described as a fix, a small correction, or small
  polish that does not add a user-visible capability. Examples: a colour or
  contrast fix, a CSS or manifest typo, a small service-worker rebuild that does
  not add a feature.

- `MINOR` — the release adds something a user can notice or use that was not there
  before, or a small set of related improvements that together amount to a visible
  step forward. On a pre-1.0 project, this is where most user-facing features go.

- `MAJOR` — the release contains a breaking or migration-worthy change. This is
  rare in a browser game, but it still applies when a change can leave old installs
  or exported state worse off: for example, a cache or manifest change that would
  leave previous users stuck, a data/state format change, or a behavioural change so
  large that previous users should be warned before upgrading.

## How to choose

Start from the user-facing question: if a user updates to this release, what is the
main thing that is different?

- If the honest answer is “mostly nothing visible, just a fix or cleanup,” use patch.
- If the honest answer is “there is a new visible capability or improvement,” use minor.
- If the honest answer is “upgrading may require attention, or something old stops
  working as it did,” use major.

Do not inflate the version just because several files changed. Do not deflate it just
because the change is small in lines. The right bump is the one that matches the user-
visible meaning of the release.

## Pre-1.0 guidance

Before 1.0, prefer minor for user-visible steps and patch for fixes and small polish.
Use major when there is a real migration or breakage concern. A version bump is not a
substitute for asking whether the change is worth releasing at all; RELEASE-GOVERNANCE.md
covers that part.

## When in doubt

If it is unclear whether a bump is major or minor, describe the change in release notes
and pick the smaller bump that still tells the truth about the release. If it is unclear
whether the change is even worth a bump, that is usually a sign it is not worth a release
tag yet.
