# PLANS.md — Work Plan Index

Purpose: help agents find the right task plan without reading every plan. This index summarizes each plan's subject and status; detailed steps and decisions belong in the linked plan files.

## How to use this index

- Start here when the user's request involves ongoing planned work, prioritization, or choosing the next task. Otherwise, do not read plans just because they exist.
- Match the request to a plan by its **scope**, not just by a shared keyword. Read only the relevant plan, and cite it when explaining the proposed steps or priorities.
- A plan describes intended work and its recorded progress; it does **not** prove what the repository currently does. Inspect the current code and tests before acting.
- Follow the plan's ordered checklist, update its progress as work is completed, and keep verification claims limited to checks actually performed.
- Add new entries only for genuine, topic-specific work plans. Update this index when a plan is added, renamed, completed, abandoned, or superseded. Keep detailed tasks in the plan itself rather than duplicating them here.

## Current plans

| Plan | Status | Use this plan for | Do not use it for |
| --- | --- | --- | --- |
| [Engine Plugins](docs/ENGINE-PLUGINS.md) | Active — implementation exists; runtime checks and calibration remain | Work on MinMax/MCTS integration, per-side and per-phase engine selection, worker dispatch/fallback, engine configuration persistence, phase thresholds, strength calibration, and the listed engine regression checks. | General AI improvements unrelated to the plugin contract, overall repository audit priorities, or proof that browser-only checks have passed. Verify current code and record actual test results. |
| [Undo/Redo and Save/Load Consistency](docs/UNDO-REDO-SAVE-TESTING.md) | Active — validation rules and regression tests being strengthened; browser checks remain | Work on history/log consistency, save import validation, legacy save compatibility, and browser verification of save/load and undo/redo. | Engine-plugin integration or claims that real-browser checks have passed. |

There are currently no other standalone work plans indexed.

## Reference documents — not work plans

These documents describe rules, facts, procedures, or history. They are not substitutes for a task plan and should not be mistaken for a checklist of future work.

- [HANDOVER](docs/HANDOVER.md) — game rules and development policy.
- [ARCHITECTURE](docs/ARCHITECTURE.md) — application structure, deployment, PWA, and build boundaries.
- [HISTORY](docs/HISTORY.md) — dated record of past decisions and changes; not the current implementation state.
- [VERSIONING](docs/VERSIONING.md), [SEMVER](docs/SEMVER.md), and [RELEASE-GOVERNANCE](docs/RELEASE-GOVERNANCE.md) — version and release procedures.
- [PROMPT](docs/PROMPT.md) — paste-ready kickoff instructions.
- [.agents/limitations.md](.agents/limitations.md) — shared agent capability and environment limits.
