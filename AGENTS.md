# AGENTS.md — Jester & Moat

Purpose: binding agent rules for execution, approvals, Git workflow, scope, and documentation. Game rules and architecture live in the referenced docs.

## 1. Intent & Approval

| Rule | Requirement |
|---|---|
| Interpret | Use full conversation, established decisions, and approved plans; prefer intent over isolated wording. |
| Authorization | Questions, discussion, hypotheticals, and suggestions do **not** authorize action. File edits require clear intent, explicit or unambiguous from context. |
| Plan | Before multi-step work, state scope, files, workflow, branch, and expected result; wait for approval. |
| Execute | Approval covers stated work and logically dependent steps only. Do not re-ask for in-scope steps or extend approval to unrelated/materially different work. |
| Re-plan | If new information materially changes the plan, explain and obtain approval first. |
| Clarify | Ask only when materially different interpretations risk consequential unwanted action. Resolve conflicts by context and instruction priority first. |
| Read-only | Reading, searching, and planning are allowed; explicit safeguards still apply. A question, file read, search, or proposed plan alone never authorizes edits. |

## 2. Startup Context

Before changing project files, read in order:
1. `AGENTS.md`
2. `docs/HANDOVER.md`
3. `docs/ARCHITECTURE.md`
4. `.agents/limitations.md`

Use them to understand current state, game/development rules, architecture, and constraints. Establish current repository state by inspection. Consult `PLANS.md` when the task intersects planned work or needs prioritization; open only the relevant plan(s), not every plan.

## 3. Scope & Canonical Sources

- GitHub repo `futuredmd20-collab/jester-and-moat` is canonical; do not substitute Drive mirrors.
- `BACKUPS/` and all contents are out of scope for ordinary project work. Never treat backups as authoritative.
- Keep edits limited to the approved objective/files; no unrelated cleanup, refactoring, or formatting.
- In Drive, work only in `Jester & Moat`. Touch nothing outside it unless specifically requested.
- Create elsewhere in Drive only if tools cannot target the project folder; disclose this.
- Never overwrite a Drive original without asking.

## 4. Branch, Commit & Review

| Rule | Requirement |
|---|---|
| Default branch | Protect `main`; never make project changes directly on it. |
| Branching | One branch per task/feature. Include branch name in plan; create only after approval. |
| Existing branch | For continuation, verify purpose, state, and relation to `main`; if unclear, stop and clarify. |
| State | Before editing, verify repo/branch state. Keep task commits on its branch. GitHub is the shared workspace. |
| Local clone | Use only if supported and after explicit user approval. It is a cache, not source of truth; task work must reach its branch before any PR. |
| Commit | Reversible commits need no separate approval when covered by the approved plan. |
| Review | Compare diff with base; check unrelated changes and run relevant checks only when appropriate and authorized. Show diff before opening a PR. |
| PR/merge | Never open a PR unless explicitly permitted; a plan explicitly including a draft PR grants permission. Never merge without explicit authorization. Edit/commit/push permission alone does not permit PR creation or merge. |
| Cleanup | After merge and verification, remove the task branch only if no longer needed and cleanup is appropriate. |

### Workflow selection

Use the established choice; if unclear, ask. Execute the chosen workflow without silently substituting another.

| Code | Workflow |
|---|---|
| A | Local commit only; no push or remote changes. |
| B | Commit and push to a specified existing remote branch. |
| C | Create branch from `main`, edit, commit, push. |
| D | C + review diff + show it to user + open draft PR. |
| E | Custom sequence agreed with user. |

If blocked, state the limitation and ask how to proceed.

### Browser testing and previews

- Prefer the existing automated tests and available browser-preview/deployment services before proposing a custom test page. For mobile/browser verification, consider GitHub Pages serving the selected working branch when configured, or an existing preview service such as Freebuff. Do not suggest building a test page by default.
- A branch being selectable for Pages does not itself guarantee that a preview is configured or that tests pass. Confirm the actual preview URL and CI result before claiming verification.
- Eruda is opt-in debugging tooling. Its local library and loader may remain on `main` and in release source snapshots, but it loads only when `?eruda=true` is present; do not change the existing `?debug=1` logger convention. Keep Eruda out of the service-worker precache and the self-contained single-file build. Preserve tests for opt-in loading and these exclusions.

## 5. Changes & External Operations

- Change only approved scope; preserve content/conventions unless the task requires otherwise.
- Verify resulting repository state when tools permit.
- Claim success only after the relevant operation succeeds. Report tool errors accurately; do not repeat failed approaches without reason.
- Never bypass permissions, branch protection, or access controls.
- Builds, installs, downloads, and uploads require explicit authorization. If necessary, include them in the approved plan first.

## 6. Documentation Map

Every documentation file must start with an accurate `Purpose` line describing what it includes/excludes. Keep it accurate when editing.

| File | Role |
|---|---|
| `docs/HANDOVER.md` | Game rules and development policy |
| `docs/ARCHITECTURE.md` | Deployment model and PWA requirements |
| `.agents/limitations.md` | Shared boundaries and agent capabilities; update the relevant record if an action is impossible, or ask the user |
| `docs/VERSIONING.md` | Release/tag procedure; read for releases, not startup |
| `docs/HISTORY.md` | Dated decisions/change history; background only, not current rules/state; not startup |
| `docs/PROMPT.md` | Paste-ready kickoff prompt |
| `PLANS.md` | Index of topic-specific work plans; consult when relevant, then read only the plan(s) needed. It is a directory, not a status report or source of implementation truth. |
| `.agents/freebuff.md`, `.agents/vibe.md`, `.agents/gemini.md` | Agent-specific capability notes |

## 7. Markdown Integrity

- Drive `.md` files must remain plain Markdown with MIME type `text/markdown`, never Google Docs/Word.
- After creating/editing a Drive `.md`, verify MIME type. If tools cannot preserve or verify it, stop and ask; do not convert.

## 8. Communication Protocol

| Output type | Format |
|---|---|
| Decisions/choices | Lettered options: A, B, C…; identify the decision required. Recommend one when useful and explain briefly. |
| Questions requiring answers | Numbered: 1, 2, 3… |
| Status/actions/blockers | State facts plainly; distinguish proposed, approved, in progress, completed, and blocked. Never invent a decision or claim an unverified success. |
| Routine replies | Lead with answer; concise, specific, plain English; usually ≤15 lines. Add detail only to prevent material ambiguity (normally ≤20–25 extra lines). |
| No choice needed | End naturally; do not add a decision list or “no decisions needed.” |

**Escape valve:** Use the format only when it improves clarity. You may depart from letter/number formatting, headings, lists, or line limits whenever needed for a clear, natural, accurate answer. Never add structure solely to satisfy a template.

When blocked, report what was attempted, the actual result, and the next viable option. Avoid needless clarification; address recurring user corrections by fixing the underlying instruction/process where possible.
