# AGENTS.md — Jester & Moat

Purpose: binding rules shared by all agents — roles, approval, scope, Git workflow, documentation and communication. Environment rules live in `.agents/env-*.md`, tool quirks in `.agents/<agent>.md`, game rules and architecture in `docs/`.

## 1. Roles

| Role | Who | Does |
|---|---|---|
| Decision-maker | The user | Assigns tasks, approves, and is the only one who merges to `main`. |
| Orchestrator / reviewer | Local Claude (host) | Distributes tasks, reviews branches, runs tests locally. Never merges. |
| Worker | Sandbox agents (Claude Code, Freebuff) | Clone, build, test and push task branches on their own. |
| Advisor / reviewer | Cloud agents (ChatGPT, Gemini, others) | Second opinions and code review; occasional code via branch + PR. |

## 2. Environment & Startup

Identify your environment by checking, not by how you are described:

| Environment | Check | File |
|---|---|---|
| Sandbox | You can run shell commands, OS is Linux and `whoami` returns `agent` — even if your model runs remotely | `.agents/env-sandbox.md` |
| Host | You can run shell commands and OS is macOS (`uname` returns `Darwin`) | `.agents/env-host.md` |
| Cloud | You cannot run shell commands; you work only through integrations | `.agents/env-cloud.md` |

Read only your own environment file. If unclear, ask.

At session start (Host and Sandbox):
- Run `git fetch`. On `main` with a clean working tree: `git pull --ff-only`. On another branch: stay on it and report if it is behind `origin/main`.
- Check that you are in the repository root, that `node --version` matches `.nvmrc`, and that the working tree is clean. If anything does not match, report it before starting work.

Before changing project files, read: this file, your environment file, your agent file (if one exists), `docs/HANDOVER.md`, `docs/ARCHITECTURE.md`. Consult `PLANS.md` only when the task touches planned work, and open only the relevant plan(s).

## 3. Approval

- Questions, discussion and suggestions do not authorize edits.
- An assigned task authorizes the steps it logically needs. Your environment file sets how much you may do without asking.
- If new information materially changes the task, stop and explain before continuing.
- Ask only when interpretations differ in a way that matters; otherwise take the most reasonable reading and state it.
- Never, in any environment: merge to `main`; bypass branch protection, rulesets or access controls; change agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.agents/`) unless the user asks.

## 4. Scope

- The GitHub repo `futuredmd20-collab/jester-and-moat` is canonical. Clones are working copies.
- Keep edits to the task: no unrelated cleanup, refactoring or formatting.
- `BACKUPS/` is out of scope and never authoritative.

## 5. Git Workflow

| Rule | Requirement |
|---|---|
| `main` | Protected by GitHub. Never commit to it; only the user merges. |
| Branch | One per task, created from the latest `main`. Name: `<type>/<short-description>` (e.g. `fix/…`, `feat/…`, `docs/…`). |
| Existing branch | Verify purpose, state and relation to `main` before continuing; if unclear, ask. |
| Commits | One per discrete step, with a message that says what and why. |
| Tests | When code changed, run `node --test tests/*.test.js` (Node 26) before pushing, or check CI if you cannot run them. |
| PR | Only when your environment file or the user allows it. |
| Results | Never claim a test, push or other operation succeeded without checking its result. |

| Code | Workflow |
|---|---|
| A | Local commit only; no push. |
| B | Commit and push to a specified existing branch. |
| C | Branch from `main`, edit, commit, push. |
| D | C + review the diff, show it to the user, open a draft PR. |
| E | Custom sequence agreed with the user. |

Each environment file sets the default workflow. If blocked, state what was attempted, the actual result, and the next viable option.

## 6. Documentation Map

Every documentation file starts with an accurate `Purpose` line; keep it accurate when editing.

| File | Role |
|---|---|
| `docs/HANDOVER.md` | Game rules and development policy |
| `docs/ARCHITECTURE.md` | Deployment model, PWA requirements, debugging tooling |
| `docs/VERSIONING.md` | Release/tag procedure; read for releases only |
| `docs/HISTORY.md` | Dated decisions; background only, not current rules |
| `docs/PROMPT.md` | Paste-ready kickoff prompt |
| `PLANS.md` | Index of work plans; open only the plan(s) needed |
| `.agents/env-*.md` | Environment rules (host, sandbox, cloud) |
| `.agents/<agent>.md` | Tool-specific quirks (ChatGPT, Freebuff, Gemini, Vibe) |

If you hit a limitation not recorded here, tell the user and suggest adding it to the relevant environment or agent file.

## 7. Communication

| Output | Format |
|---|---|
| Choices | Numbered options (1, 2, 3…); letters for combined decisions. Recommend one when useful, briefly. |
| Status | Plain facts; distinguish proposed, approved, in progress, done and blocked. |
| Routine replies | Lead with the answer; concise, plain English; usually ≤15 lines. |

Use the format only when it improves clarity; never add structure just to satisfy a template.
