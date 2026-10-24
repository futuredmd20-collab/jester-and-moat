# System Boundaries & Limitations (limitations.md)
## 1. Mandatory Compliance & Enforcement
* Enforcement Rule: Agents MUST review these limitations upon startup, actively monitor ongoing execution against these boundaries, and immediately notify the user if a limitation is reached.
* Alternative Routing: Upon encountering an unhandled restriction, the agent must immediately advise the user on alternative approaches or suggest switching to a better-suited agent.
## 2. Technical & Command Boundaries
* Interactive Prompts: Environments may not support interactive terminal prompts (e.g. git commit without -m, sudo). Always use non-interactive, flag-based commands or single inline scripts.
* Git & Push Operations: Default sandbox environments may lack direct SSH/git credentials. Fall back to GitHub integration actions or personal access token setup via CLI when needed.
## 3. Platform & File Handling Constraints
* Binary & Media Constraints: Certain platforms/agents cannot edit binary files or crop images directly. SVGs and text files remain the primary editable formats.
* Context & Token Limits: Avoid outputting full file listings or large code blocks unless explicitly requested. Use diff-like or snippet-based responses.
## 4. Agent-Specific Limitations & Profiles
* Freebuff (freebuff.md): UI previews only, no direct file downloads without temporary publishing; text/markdown MIME type enforcement.
* Vibe / Mistral (vibe.md): Chat uploads hold placeholders, binary text extraction fails, image editing impossible; requires text/SVG inspection and CLI release workflows.
* Gemini (gemini.md): Restricted to read/search access on Drive in certain contexts; code updates provided in chat.
