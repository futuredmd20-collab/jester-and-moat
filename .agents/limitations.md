# System Boundaries & Limitations

Purpose: shared agent boundaries and capability records. Not for game facts, architecture, or change history; see `docs/HANDOVER.md`, `docs/ARCHITECTURE.md`, and `docs/HISTORY.md`.

## 1. Mandatory Compliance & Enforcement
- Review these limitations at startup, monitor ongoing execution against them, and immediately notify the user if a limitation is reached.
- When an unhandled restriction is encountered, advise the user on alternatives or suggest switching to a better-suited agent.
- Agents using different tools or environments should document relevant capability constraints here or in the appropriate agent profile.

## 2. Technical & Command Boundaries
- Interactive prompts may not be supported (for example, terminal prompts for `git commit` or `sudo`). Prefer non-interactive, flag-based commands or single inline scripts.
- Default sandbox environments may lack direct SSH/Git credentials. Use the available GitHub integration when possible; do not assume credentials are absent without checking the available integration.
- Do not expose credentials. If the user explicitly chooses to configure a token, read it without echoing it and follow the provider's documented authentication flow.
- Some platforms cannot edit binary files or crop images directly. SVG and text files are often the most reliable editable formats.
- Avoid dumping full file listings or large code blocks unless requested; use focused diffs and snippets.

## 3. File Handling & External Storage
- The GitHub repository is the canonical, editable source for project files and documentation. Drive Markdown mirrors were retired on 2026-10-20.
- Drive is for saved games and the user's own ZIP backups in `BACKUPS/`; documentation copies outside GitHub are one-off exports that can become stale.
- In Google Drive, work only inside the `Jester & Moat` folder. Do not touch other Drive material unless the user specifically asks.
- Markdown files created in Drive must remain plain-text files with the `text/markdown` MIME type, not Google Docs or Word documents. Verify the MIME type after creation or editing; stop and ask if the available tool cannot preserve or confirm it.
- Some Drive upload tools require a staged file reference and cannot upload a workspace file directly. If staging is unavailable, explain the limitation; do not pretend an upload succeeded.
- A workspace file path is not necessarily a public download URL. The Freebuff mobile Files panel and mobile website may preview files without offering a download action.
- Buffy may temporarily publish only the requested artifact for download with the user's explicit approval, then unpublish it after the user confirms the download.

## 4. GitHub & Release Operations
- Some sandbox environments lack Git credentials for `git push`; repository changes may need to use GitHub integration actions.
- GitHub integrations may reject large inline file payloads even when the file is valid. If that blocks an approved change, explain the issue and use an approved alternative route.
- The integration is account-scoped in some environments; verify with a live API call before concluding it is unavailable.
- Some integrations can read tags and releases but cannot create them. In this project, annotated tags and GitHub Releases may need to be created by the user from a local clone following `docs/VERSIONING.md`.
- A local clone is a cache, not the source of truth, and may be used only with the user's explicit approval. The task branch on GitHub remains the shared working state.

## 5. Agent-Specific Profiles
- **Freebuff / Buffy:** see `.agents/freebuff.md` for mobile preview/download limits and Markdown MIME-type constraints. In some sessions, Drive searches and reads work while uploads require a staging reference that is unavailable. If asked for a documentation copy, provide it as a one-off export and explain that it will drift from the repository. ZIP backups may need to be downloaded and uploaded by the user.
- **Vibe / Mistral:** see `.agents/vibe.md` for binary upload placeholders, image-editing constraints, workspace resets, SVG text workflows, and release-tag limitations. If a file upload is represented only by a placeholder, binary text extraction and pixel-level image edits are not possible in that session.
- **Gemini:** see `.agents/gemini.md` for Drive read/search restrictions, file-operation limitations, and user-applied code updates.
- **Other agents:** document relevant constraints in the appropriate profile and update this shared index when a new profile is added.
