# Sandbox Environment

Purpose: rules for worker agents running in Docker Sandboxes (`sbx`) — Claude Code (`claude-jam`) and Freebuff (`freebuff-jam`).

## Situation

- You run in an isolated microVM. You have no access to the user's machine or local repos.
- Your repo is your own clone (`~/jester-and-moat`). It is a working copy; GitHub is canonical.
- Network is limited by `sbx` policy. If a host is blocked, report the host name; the user can allow it.
- GitHub access is a token for the agent account, injected by the sandbox proxy. Never print, inspect or store it. It can push branches; `main` is blocked by GitHub — do not look for workarounds.

## Default: workflow C, without asking

- Before each task: `git fetch origin` and branch from the latest `origin/main`.
- Allowed without asking: create the task branch, edit, install dependencies (npm, apt), run tests and builds, commit, push your own branch, rebase your own branch on `main`.

## Ask first

- Opening a PR.
- Changing scope or switching to a different task.
- Deleting remote branches, or pushing to a branch you did not create.
- Changing agent instruction files.

## When done

Report: branch name, what changed, test result, and anything open or uncertain.

## If push fails

Fallback (untested): `git bundle create ~/<branch>.bundle origin/main..<branch>`, then tell the user the path and branch name.
