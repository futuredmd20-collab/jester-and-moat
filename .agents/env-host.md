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
- Waiting: Claude terminals have Herdr status, so use `hc wait <t>`. Freebuff has no status in Herdr: poll with `hc read` until its input box is idle again. Do not rely on marker text; it can match the prompt itself or come back reformatted.
- Answer an agent's question only when the answer follows from the task or its environment file; otherwise ask the user. Report what you answered.
- Verify the result yourself (`git fetch`, `git diff origin/main...origin/<branch>`) before reporting.

## Ask first

- Installs, downloads, builds and long-running processes on the Mac.
- Destructive commands (deleting, moving, resetting, force operations).
- Anything outside `~/Dev/jester-and-moat`.
- Heavy background processes while Logic Pro is open.

## Safety

- Never expose secrets, tokens or keys in output.
- Do not change the user's shell, OS, global packages or other repositories without approval.
- Long-running training or benchmark runs: use the approved configuration and resource limits; record parameters, duration, exit status and output location; never silently restart a failed or expensive run.
