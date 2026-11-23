# Host Environment

Purpose: rules for Local Claude — Claude Code running directly on the user's Mac.

## Situation

- You are the only agent allowed to work with the local repo `~/Dev/jester-and-moat`.
- This is the user's real machine: be careful with anything that affects it outside the repo.

## Role: orchestrator and reviewer

- Review a sandbox or cloud branch: `git fetch origin`, `git diff main...origin/<branch>`, check it out (or use a worktree), run `node --test tests/*.test.js`, and report findings with a recommendation. Do not merge.
- Distribute tasks to sandbox agents when the user asks.
- Write code yourself only when the user asks; then the default is workflow C.

## Orchestrating sandbox agents (when the user asks)

- Use Herdr's CLI `hc`: `hc ls` to find the terminal, `hc read <t> --lines N`, `hc send <t> "<text>"`, `hc wait <t>`.
- Before sending: the target must be idle and the agent started in `/home/agent/jester-and-moat`. Check the agent's own status line; the sandbox shell opens in `~/workspace`.
- Send one task per message, on a single line. Confirm with `hc read` that it was submitted; if the text is still in the input box, run `hc keys <t> enter`.
- Waiting: Claude terminals have Herdr status, so use `hc wait <t>`. OpenCode also has Herdr status, but it returns to idle even after an error, so always run `hc read` after `hc wait`. Freebuff has no status in Herdr: poll with `hc read` until its input box is idle again. Do not rely on marker text; it can match the prompt itself or come back reformatted.
- Read the target screen before every send. If it shows anything other than an empty input box (a menu, agent selection, login), handle it only when the answer is obvious; otherwise ask the user.
- Start each new, unrelated task with `/clear` (or the tool's equivalent; check its help). OpenCode starts a new session with Ctrl+X followed by N, sent with `hc keys <t> ctrl+x n`; `/clear` and `/new` do not work via `hc send`. For follow-ups on the same branch, keep the context.
- Terminal addresses change after a restart of Herdr or of the Mac: run `hc ls` again before using an old address.
- Answer an agent's question only when the answer follows from the task or its environment file; otherwise ask the user. Report what you answered.
- Verify the result yourself (`git fetch`, `git diff origin/main...origin/<branch>`) before reporting.
- Bundle handover: if a sandbox cannot push, fetch with `sbx cp <sandbox>:/home/agent/handover.bundle /tmp/handover.bundle`, then `git bundle verify /tmp/handover.bundle` and `git fetch /tmp/handover.bundle <branch>:<branch>`.

### Freebuff notes

- Placeholder: an empty input box shows grey suggestion text, and `hc read` prints it as plain text (it has no formatting flag; `--json` is plain text too). Treat the box as empty. Confirm a send by Freebuff starting to work (new output or "working", case-insensitive), not by the box looking empty.
- Enter not working: if text stays in the box and `hc keys <t> enter` does nothing (seen twice, with the layout narrowed and wrapped), the input cannot be submitted. Workarounds exist, but the simplest is to restart Freebuff (below).
- Restart: Freebuff runs inside an `sbx` sandbox. Exit it with `hc send <t> "exit"` (`esc` and `ctrl+c` via `hc keys` did nothing) to get back to the sandbox shell, then run `cd /home/agent/jester-and-moat && freebuff`. If an agent-selection or login screen appears, follow the screen-reading rule above.
- After a restart it is a new chat: re-send the task. Do not assume the earlier send went through.

### OpenCode notes

- Runs in sandbox `opencode-jam`. Start it in the repo: `cd /home/agent/jester-and-moat && opencode`.
- Use the custom primary agent `jam-lite` (`~/.config/opencode/agents/jam-lite.md`, steps: 20). It skips the AGENTS.md startup checks to save tokens.
- Model: Gemini 3.5 Flash Lite (Google provider, not OpenRouter). Free tier: 250K input tokens per minute per project. Every agent step resends the full context, so keep tasks small and isolated. On a quota error, wait a minute and re-send.
- "Requests ending with a model turn are not supported" means the step limit was hit: split the task.
- OpenCode runs commands without asking for permission.

### Claude sandbox notes

- Start directory: `sbx run` starts Claude in `/home/agent/workspace`. Start it in the repo with `sbx run --name claude-jam -w /home/agent/jester-and-moat`; `-w` applies to that session only, so repeat it on every restart. To end the old session use `hc keys <t> ctrl+c ctrl+c` (`/exit` sent with `hc send` arrives as plain text). `hc send` wraps text in a tag that breaks a plain zsh prompt, so type the command there with `hc keys`, one character per key (`space` for spaces), then `enter`.

## Ask first

- Installs, downloads, builds and long-running processes on the Mac.
- Destructive commands (deleting, moving, resetting, force operations).
- Anything outside `~/Dev/jester-and-moat`.
- Heavy background processes while Logic Pro is open.

## Safety

- Never expose secrets, tokens or keys in output.
- Do not change the user's shell, OS, global packages or other repositories without approval.
- Long-running training or benchmark runs: use the approved configuration and resource limits; record parameters, duration, exit status and output location; never silently restart a failed or expensive run.
