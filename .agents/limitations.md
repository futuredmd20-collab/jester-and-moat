# System Boundaries & Limitations

Shared agent capability boundaries—not game facts, architecture, or change history. See `docs/HANDOVER.md`, `docs/ARCHITECTURE.md`, and `docs/HISTORY.md`.

## 1. Compliance & Enforcement
- Review these limits at startup and during work; notify the user immediately when one is reached.
- For an unhandled restriction, explain alternatives or suggest a better-suited agent.
- Record environment-specific constraints in the relevant agent profile; update this index when adding a profile.

## 2. Technical & Command Boundaries
- Interactive prompts may fail (e.g. `git commit`, `sudo`); prefer non-interactive flags or inline scripts.
- SSH/Git credentials may be unavailable in a sandbox. Check available GitHub integration before assuming access is absent.
- Never expose credentials. If the user explicitly chooses to configure a token, read it without echoing it and follow the provider's documented authentication flow.
- Binary editing and direct image cropping may be unsupported; SVG and text are often the most reliable editable formats.
- Avoid full file listings and large code dumps unless requested; prefer focused diffs and snippets.

## 3. Files & External Storage
- GitHub is the canonical editable source. Drive Markdown mirrors were retired on 2026-10-20; documentation copies outside GitHub are one-off exports and may become stale.
- Use Drive only inside the `Jester & Moat` folder, except when the user explicitly asks to access other material. Drive is for saved games and the user's own ZIP backups in `BACKUPS/`.
- Drive Markdown must be plain text with MIME type `text/markdown`, not Google Docs or Word. Verify the MIME type after edits; stop and ask if the tool cannot preserve or confirm it.
- Some Drive upload tools require a staged file reference. If staging is unavailable, explain the limitation rather than claiming success.
- A workspace path is not necessarily a public download URL; Freebuff's mobile Files panel and mobile website may preview files without offering downloads.
- Buffy may temporarily publish only the requested artifact for download with the user's explicit approval, then unpublish it after the user confirms the download.

## 4. GitHub & Release Operations
- If sandbox Git credentials prevent `git push`, use available GitHub integration actions where possible.
- If GitHub branch-creation or Contents API writes are blocked by tool security controls, don't repeatedly retry the same action. Use the Git Database Objects workflow where available: create blobs, create a tree based on the current branch tree, create a commit with the intended parent, then create or update the branch ref. Verify the resulting branch and commit. This workflow does not bypass permissions or branch protection. If ref creation is also unavailable, stop and report the specific missing capability; never write directly to `main` as a workaround.
- Large inline payloads may be rejected even when valid; explain the issue and use an approved alternative.
- Integrations can be account-scoped. Verify with a live API call before concluding access is unavailable.
- Some integrations can read tags/releases but not create them. In this project, the user may need to create annotated tags and GitHub Releases from a local clone using `docs/VERSIONING.md`.
- A local clone is only a cache and may be used only with the user's explicit approval. The GitHub task branch remains the shared working state.

## 5. Agent-Specific Profiles
| Agent | Profile / constraints |
| --- | --- |
| **Freebuff / Buffy** | See `.agents/freebuff.md` for mobile preview/download and Markdown MIME-type limits. Drive reads/searches may work when uploads require unavailable staging. Documentation copies are one-off exports and can drift; ZIP backups may need user-managed download/upload. |
| **Vibe / Mistral** | See `.agents/vibe.md` for binary-upload placeholders, image-editing limits, workspace resets, SVG text workflows, and release-tag limits. A placeholder-only upload prevents binary text extraction and pixel-level image edits in that session. |
| **Gemini** | See `.agents/gemini.md` for Drive read/search restrictions, file-operation limits, and user-applied code updates. |
| **Other agents** | Record constraints in the relevant profile and update this index when adding it. |
