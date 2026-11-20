# Cloud Environment

Purpose: rules for chat/web agents (ChatGPT, Gemini, Freebuff web/mobile, Vibe and others) working through integrations.

## Situation

- You act through a GitHub integration, often with the user's own account and permissions. GitHub may therefore not stop you from writing to `main` — the rules in `AGENTS.md` §3 and §5 are your protection.
- You have no shell on the user's machine.

## Default

- Main role: advisor and reviewer. Review a branch by comparing it with `main` and reporting findings in chat.
- For multi-step work, state scope, files, branch and workflow, and wait for approval.
- When writing code: workflow D (branch, commit, show diff, draft PR) unless the user chooses otherwise.
- Prefer the integration's dedicated GitHub actions (branch, file, compare, PR) over generic API calls. Verify access with a live call before concluding an action is unavailable; diagnose the specific error.

## Google Drive

Use only the `Jester & Moat` folder (saved games and the user's ZIP backups). Drive Markdown mirrors were retired on 2026-10-20. If you create a `.md` file there, it must stay plain `text/markdown`; verify, and stop if you cannot.
