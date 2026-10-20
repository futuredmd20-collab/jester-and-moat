# LIMITATIONS.md — AI Agent Constraints & Capabilities
- Records agent-specific technical constraints and capabilities when working with this project. Not for project facts (HANDOVER.md, ARCHITECTURE.md) or change history (HISTORY.md).
- Agents must keep this file tidy: preserve its existing structure and style, avoid introducing new formatting styles, and do not add unnecessary blank lines or spacing.

## Freebuff mobile downloads
- The Files panel in the Freebuff mobile app and mobile website previews workspace files but has no download action; long-pressing a file does not open a download menu.
- A workspace file path is not a public download URL.
- With the user’s explicit approval, Buffy can temporarily publish only the requested artifact for download, then unpublish it after the user confirms they have downloaded it.

## Buffy (this Freebuff/Codebuff agent): Google Drive
- Drive receives no project docs: the .md mirrors were retired on 2026-10-20. Drive holds saved games and the user's own ZIP backups in **BACKUPS**, both user-managed.
- In this session, Buffy could search and read Drive files but could not upload a ZIP directly from the workspace: the available upload actions required a staged file reference that Buffy could not create. ZIP backups are therefore downloaded by the user and uploaded by the user.
- Buffy’s attempt to upload from the local preview URL was denied because Drive could not access that URL.
- If the user asks for a doc copy, write it once as an export and say plainly that it will drift from the repo.
- Markdown files in Drive, when created at all, must remain plain text with the `text/markdown` MIME type.
- Drive cannot receive a workspace file without a staged upload reference. Text and Markdown travel as uploads; images and other binaries do not, so a chat whose only channel is Drive text uploads must split large files and leave binaries behind.

## Buffy (this Freebuff/Codebuff agent): GitHub
- The sandbox carries no git credentials by default: `git push` fails and commits can only go through the GitHub integration's commit, branch, and pull-request actions.
- The CLI path works once a classic personal access token with `repo` scope is installed by the user through `gh auth login --with-token` (read the token with `read -rs`, never echo it) followed by `gh auth setup-git`; `git clone`, `git push`, and `gh pr create` then succeed. Use this route when the integration refuses a payload for size.
- A GitHub-capable integration can still refuse a large inline payload even when the file itself is valid; the piece-sprite change had to leave its chat through Drive because `pieces.svg` was too large to commit that way.
- The integration is account-scoped: no per-session login; confirm with a live API call before concluding it is missing.

## Vibe (this Mistral GLM agent)
- Files uploaded in chat are not stored as bytes: the filesystem holds a placeholder, text extraction fails on binary uploads, and images are only viewable through a vision model's textual description. Pixel-level work on uploaded images (cropping, background removal) is therefore impossible in this session.
- Text is the working route: SVG sources can be read verbatim from Drive (download_file_content) or GitHub (get_file_contents) and split without touching path data; the flat piece crops on this branch were produced that way.
- The sandbox resets between some calls, so intermediate workspace files can vanish; keep durable copies on Drive or in the repo.

## Gemini
- Drive access may be limited to reading and searching; copying, overwriting, or editing files may not be available.
- Code updates may need to be provided in chat for the user to apply locally.

## Other AI agents
- Agents using different tools or environments should document their own relevant capability constraints here.
- If an agent encounters an undocumented functional limitation, it should add a concise note here or ask the user to record it.
