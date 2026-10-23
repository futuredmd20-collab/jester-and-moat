## GitHub integration — current gaps (Freebuff agent sessions)

These are known limitations of how the Freebuff GitHub integration behaves
from an agent session. They are recorded so the same blockers are not
re-diagnosed in every session.

### 1. Not every GitHub action is covered by the integration tools

The Freebuff GitHub tools are best for reads and for the common writes the
integration exposes directly. When an action you need is not reliable or not
available through those tools, do the work through the GitHub REST API route
instead:

- branch refs (create/update/delete)
- file content (create/update/delete by path and sha)
- commits across multiple files in one shot
- pull requests (open/update)

If a write through the integration fails or is unavailable, treat the GitHub
API as the intended fallback rather than retrying the same integration call.

### 2. Some write shapes still need the API

A few things that look expressible from the tool list are not dependable in
this environment and should go through the API or a local clone:

- deleting a non-empty directory tree
- forcing a branch ref in one shot
- operations that depend on precise tree/sha state beyond a single-file
  upsert/delete

When a write needs one of those, do not keep re-casing it through the
integration tools; switch to the API route.

### 3. `git push` from the cloud sandbox is not usable here

From this cloud workspace, `git push origin <branch>` fails with

    fatal: could not read Username for 'https://github.com': No such device or address

or an equivalent credential/device error. That is a sandbox credential and
connectivity gap, not a repository problem.

Consequence: when a Git action cannot authenticate locally, use the Freebuff
GitHub integration as the primary write path, and use the GitHub REST API as
the fallback for anything the integration does not cover (branch refs,
multi-file commits, pull requests, forced updates).

### 4. When in doubt, prefer the API route for writes that the integration
does not cleanly express

If a desired write is not obviously covered by the integration, do not spend
a session re-verifying the same limitation. Route it through the GitHub API
and record the result.

How this was discovered

- `engine-plugins-step1` was recreated locally as a single commit on top of
  `main`, but `git push` could not authenticate from the cloud sandbox.
- The same branch content was then published through the GitHub API route
  (multi-file commit + branch update), and the matching PR was opened
  through the API.
- `engine-plugins-design` was updated locally and the same auth gap blocked
  a plain `git push`, so its update is also written through the API when
  needed.

This is a limitation note, not a plan to close it.
