# Gemini Agent Limitations (gemini.md)

## Drive & File Operations
* Direct file overwrites or format conversions are restricted; markdown files must be created directly with `text/markdown` plain text mime-types to prevent Google Workspace conversion.
* When working with files on Drive, actions take place incrementally with user approval.

## GitHub Integration
* Does not possess direct credentials for direct push access to remote git repositories; changes are staged via user-approved files or chat output.
