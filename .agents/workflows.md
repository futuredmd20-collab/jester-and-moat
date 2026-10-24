# Execution Workflows (workflows.md)

## 1. Handover & Session Transfer
* When transferring state across chat sessions or clients, generate a minimal state summary containing:
  - Current task status
  - Pending action items
  - Modified file list

## 2. Standard Task Execution
* Receive task -> Confirm scope -> Execute minimal code modification -> Verify result.
* For git/terminal operations, generate non-interactive inline scripts.

## 3. Google Drive Staging & Intermediate Working Copies
* Agents may utilize Google Drive for staging, sharing temporary working copies, or storing repository clones.
* Other agents or the user can read from or write to these staged copies to prepare branches, review changes, or generate pull requests directly to GitHub.
