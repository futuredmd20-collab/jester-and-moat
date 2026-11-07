# PLANS.md — Work Plan Index

Purpose: help agents find the right topic-specific work plan without reading every plan. This is a directory, not an implementation report; detailed progress, decisions, and verification belong in the linked plan files.

## How to use this index

- Start here when the user's request involves ongoing planned work, prioritization, or choosing the next task. Otherwise, do not read plans just because they exist.
- Match the request to a plan by its **scope**, not just by a shared keyword. Read only the relevant plan(s), cite it when explaining the proposed steps or priorities.
- A plan describes intended work and its recorded progress; it does **not** prove what the repository currently does. Inspect the current code and tests before acting.
- Follow the plan's ordered checklist, update its progress as work is completed, and keep verification claims limited to checks actually performed.
- Add new entries only for genuine, topic-specific work plans. Update this index when a plan is added, renamed, completed, abandoned, or superseded. Keep detailed tasks in the plan itself rather than duplicating them here.

## Status labels

| Status | Meaning |
| --- | --- |
| **Completed** | The plan's defined scope and recorded verification are complete; retain it as a reference where useful. |
| **In progress** | Work has started, but planned tasks or verification remain. |
| **Planned** | Work has not started. |
| **On hold** | Work is intentionally paused. |
| **Superseded** | Replaced by another plan or an explicit project decision. |

A status summarizes progress recorded in the plan; it does not prove current runtime behavior. Check the implementation and tests before making that claim.

## Current plans

| Plan | Status | Use this plan for | Do not use it for |
| --- | --- | --- | --- |
| [Layout and Piece Design](docs/LAYOUT-AND-PIECE-DESIGN-PLAN.md) | **Completed** | Reference for the completed piece designs, Jester/Moat visuals, board styling, responsive 10x8 layout, and rendering across piece surfaces. | New engine/AI algorithms, game rule changes, or save/load state logic. |
| [Engine Interface Architecture](docs/ENGINE-INTERFACE-PLAN.md) | **Completed** | Reference for the implemented shared MinMax/MCTS contract, worker transport, lifecycle handling, cross-engine regressions, and bounded search. | New engine-interface changes; treat browser/device performance caveats in the plan as unresolved observations, not completed verification. |
| [Engine Plugins](docs/ENGINE-PLUGINS.md) | **In progress** | Reference for the completed integration/test pass, the tiered engine testing workflow, and remaining parked engine work. | New engine-interface architecture or changes to the shipped presets without measured evidence. |
| [Engine Configuration](docs/ENGINE-CONFIGURATION-PLAN.md) | **Planned** | Configure engines and strength independently per side and phase; provide editable presets, expanded random configuration, and 2 Player Pass restrictions. | Personality implementation, alternative board sizes, standard-chess opponents, or general engine algorithm work. |
| [Bitboard Engine Evaluation and Migration](docs/BITBOARD-ENGINE-PLAN.md) | **Planned** | Evaluate 80-square bitboard encodings and, if measurements justify it, add a narrowly scoped engine-internal accelerator while retaining the canonical matrix board. | Replacing the game-state board, changing save/load or UI formats, or assuming bitboards improve performance without measurement. |
| [Undo/Redo and Save/Load Consistency](docs/UNDO-REDO-SAVE-TESTING.md) | **Completed** | Work on history/log consistency, save import validation, legacy save compatibility, and browser verification of save/load and undo/redo. | Engine-plugin integration or claims that real-browser checks have passed. |

## Reference documents — not work plans

These documents describe rules, facts, procedures, or history. They are not substitutes for a task plan and should not be mistaken for a checklist of future work.

- [HANDOVER](docs/HANDOVER.md) — game rules and development policy.
- [ARCHITECTURE](docs/ARCHITECTURE.md) — application structure, deployment, PWA, and build boundaries.
- [HISTORY](docs/HISTORY.md) — dated record of past decisions and changes; not the current implementation state.
- [VERSIONING](docs/VERSIONING.md), [SEMVER](docs/SEMVER.md), and [RELEASE-GOVERNANCE](docs/RELEASE-GOVERNANCE.md) — version and release procedures.
- [PROMPT](docs/PROMPT.md) — paste-ready kickoff instructions.
- [Engine Strength Calibration](docs/ENGINE-STRENGTH-CALIBRATION.md) — method and runner for relative MinMax/MCTS strength measurements; not a plan or a record of completed results.
- [Engine Testing Workflow](docs/ENGINE-TESTING-WORKFLOW.md) — test levels, reduced-comparison guidance, uncertainty, and manual full-calibration policy for engine development.
- [Engine and Board Ideas](docs/ENGINE-IDEAS.md) — idea-stage register for standard-chess opponents, alternative board sizes/setups, and future engine personalities; personality is a possible later extension of Engine Configuration, not part of that plan's implementation scope.
- [.agents/limitations.md](.agents/limitations.md) — shared agent capability and environment limits.
