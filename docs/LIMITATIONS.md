# LIMITATIONS.md — AI Agent Constraints & Capabilities
- Records agent-specific technical constraints and capabilities when working with this project. Not for project facts (HANDOVER.md, ARCHITECTURE.md) or change history (HISTORY.md).
- Agents must keep this file tidy: preserve its existing structure and style, avoid introducing new formatting styles, and do not add unnecessary blank lines or spacing.

## Freebuff mobile downloads
- The Files panel in the Freebuff mobile app and mobile website previews workspace files but has no download action; long-pressing a file does not open a download menu.
- A workspace file path is not a public download URL.
- With the user’s explicit approval, Buffy can temporarily publish only the requested artifact for download, then unpublish it after the user confirms they have downloaded it.

## Buffy (this Freebuff/Codebuff agent): Google Drive
- In this session, Buffy could search and read Drive files but could not upload a ZIP directly from the workspace: the available upload actions required a staged file reference that Buffy could not create.
- Buffy’s attempt to upload from the local preview URL was denied because Drive could not access that URL.
- If direct transfer is unavailable, Buffy should explain the limitation and offer a user-mediated download route. Buffy must not overwrite canonical Drive files without explicit authorization.
- Markdown files in Drive must remain plain text with the `text/markdown` MIME type.

## Buffy (this Freebuff/Codebuff agent): GitHub
- No git credentials in this sandbox: `git push` fails, so commits go through the GitHub integration's commit, branch, and pull-request actions.
- The integration is account-scoped: no per-session login; confirm with a live API call before concluding it is missing.

## Gemini
- Drive access may be limited to reading and searching; copying, overwriting, or editing files may not be available.
- Code updates may need to be provided in chat for the user to apply locally.

## Other AI agents
- Agents using different tools or environments should document their own relevant capability constraints here.
- If an agent encounters an undocumented functional limitation, it should add a concise note here or ask the user to record it.
