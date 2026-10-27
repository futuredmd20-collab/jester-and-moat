# Tests

Purpose: holds test documents and instructions for verifying Jester & Moat behavior. Tests are manual unless otherwise noted. Each test file documents its purpose, dependencies, and run commands.

## Test Suites

| File | Purpose | Dependencies | Run Command |
|---|---|---|---|
| [engine-plugins.md](./engine-plugins.md) | Engine plugin verification (worker dispatch, configuration, phase classification, strength calibration, regressions, performance) | Browser with console, single-file build or PWA | Open in browser, follow manual steps |

## How to Run

1. **Single-file build**: Open `jester-and-moat.html` directly in a browser (no server required).
2. **Multi-file PWA**: Serve the repo root over HTTPS (e.g., `python -m http.server` with HTTPS wrapper) and open `index.html`.
3. For both: open DevTools (F12) and the Console tab before starting tests.

## Reporting Results
- Record pass/fail and notes in the test file's template section.
- For failures, include:
  - Browser and version
  - Build type (single-file or PWA)
  - Steps to reproduce
  - Console errors or unexpected behavior
- Update `docs/HISTORY.md` with verification results and any fixes applied.

## Adding Tests
- Add new test files in this folder with a clear `Purpose` line.
- Include dependencies, run instructions, and expected outcomes.
- For automated tests, add a `run` script or command in the table above.
