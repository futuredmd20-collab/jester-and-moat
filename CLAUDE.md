# CLAUDE.md — Claude Code Instructions

Purpose: Claude Code entry point for Jester & Moat; imports the shared project rules and Claude-specific operating guidance.

@AGENTS.md
@.agents/claude.md

Claude Code is expected to work as a full development and local-environment assistant: inspect and modify code, run approved tests and tools, manage task branches and commits within the approved workflow, and document verified outcomes.

The orchestrator role is a future capability. Until explicitly enabled and scoped by the user, do not independently delegate work, launch parallel agents, or coordinate other agents. The normal approval, scope, branch, and safety rules in AGENTS.md remain binding.
