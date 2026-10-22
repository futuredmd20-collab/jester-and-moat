PR-WORKFLOW.md — Step-by-Step Pull Request Workflow
Purpose: a reusable guide to proposing, reviewing, and landing a change through GitHub pull requests. Not a replacement for project-specific AGENTS.md rules or release instructions.

# Pull Request Workflow

This guide describes the workflow used for the flat-SVG cleanup PR. It separates your decisions from the repository work I can prepare. GitHub is canonical; local edits are not a substitute for changes to the repository.

## Roles at a glance

**You:** describe the outcome, confirm the scope, approve the proposed diff, authorize commit/push/PR actions as needed, review the PR, and explicitly authorize merging.

**Me:** inspect the canonical repository, propose a plan, work on a dedicated branch, make only approved changes, show and verify the diff, and perform only the GitHub actions you authorize.

## Step by step

1. **Describe the task — You.** Say what outcome you want. If a request could mean different things, clarify which files or behavior are in scope.
2. **Plan and confirm scope — Me, then you.** I inspect the canonical GitHub state and relevant files, then state the intended paths and actions, including the task branch I will create. I wait for your confirmation before making changes. A general "go ahead" applies to the confirmed scope; it does not authorize unrelated changes.
3. **Create the task branch — Me, after your go.** I create or use a dedicated branch based on the current `main`. I verify the branch and base before editing. I do not work directly on `main`.
4. **Make the agreed changes as commits on the branch — Me.** I edit the canonical project files directly on that branch; branch commits are free and reversible, so no separate pre-commit approval is needed. I do not keep a local copy as the working state: the branch is the shared workspace, so any agent or the user can pick the work up from GitHub. If my environment supports a local clone, I may work there for speed and verify-before-publish editing — but only after asking you and getting your approval, and the clone is a cache: the work is pushed to the branch before any PR.
5. **Verify and present — Me.** One verification pass: I inspect the changed paths and complete diff on the branch, run relevant checks when appropriate, and report limitations plus the PR scope that will follow. I show you the proposal before opening a PR.
6. **Authorize the PR — You.** Review the listed files and changes. Ask for revisions if needed. The PR opens only after you approve the diff and explicitly say to open it.
7. **Open the pull request — Me, after authorization.** I check that the branch is present on GitHub, compare it with `main`, check for an existing PR, and open a PR targeting `main`. I report its link. (Scope verification was folded into step 5.)
8. **Review the PR — You.** Inspect the PR on GitHub, including its diff, checks, and any review feedback. Request changes if anything is not right.
9. **Merge — You authorize; I execute only if asked.** I merge only after you explicitly tell me to merge. Before merging, I check that the PR is open and mergeable and note any required checks or reviews. I then verify the merged state and resulting `main` commit. Opening a PR or approving its diff is not permission to merge.
10. **Close the loop — Me.** I report what was completed, the resulting commit or PR, checks run or skipped, and any follow-up required. Publishing a release or deploying is a separate action and requires its own authorization.

## Example: flat-SVG cleanup PR

- You clarified that the scope was exactly the seven `flat-*.svg` files plus the requested rules in `docs/AGENTS.md`; `pieces-flat.svg` was to remain.
- I created a dedicated branch from the current GitHub `main`, deleted those seven files, updated `docs/AGENTS.md`, and showed the diff.
- You approved the diff. I committed the eight changed paths, pushed the branch, and opened PR #2 against `main`.
- You explicitly asked me to merge the PR. I checked that it was open and mergeable, then merged it and verified the new `main` commit.

## Flowchart

```mermaid
flowchart TD
    A[You describe the outcome] --> B[Me: inspect canonical GitHub state and propose scope + task branch]
    B --> C{You confirm plan and scope?}
    C -- No --> B
    C -- Yes --> D[Me: create dedicated branch from current main]
    D --> E[Me: make the agreed changes as commits on the branch]
    E --> F[Me: one verification pass - diff, checks, PR scope]
    F --> G{You approve diff and authorize PR?}
    G -- No --> H[You request revisions]
    H --> E
    G -- Yes --> I[Me: open PR against main]
    I --> J[You review PR and checks]
    J --> K{You explicitly authorize merge?}
    K -- No --> L[Leave PR open; wait for instructions]
    K -- Yes --> M[Me: verify merge readiness and merge]
    M --> N[Me: verify merged PR and main; report outcome]
```
