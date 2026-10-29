# Jester & Moat

Jester & Moat is a browser-based chess variant played on a **10 × 8 board**. It combines familiar chess pieces with a Jester, special moat barriers, and built-in AI opponents. The app is designed as an installable, offline-capable Progressive Web App (PWA).

## Features

- Play against another person or the AI, or run AI vs. AI.
- Use the Jester: it moves like a queen up to three squares and can swap places with an adjacent friendly piece that has already moved.
- Place 1 × 3 moats during play; moats affect movement and can be destroyed by enemy pieces.
- Customize the board, piece style, and appearance.
- Edit positions, set clocks, undo/redo moves, autoplay, and save or load games.

## Play

Open the hosted app: [Jester & Moat on GitHub Pages](https://futuredmd20-collab.github.io/jester-and-moat/).

The app is a static site and requires no backend. Once loaded and cached, its PWA service worker supports offline play.

## Development

The primary app is the multi-file version: `index.html`, `style.css`, `pieces.css`, `script.js`, the piece sprites, `manifest.json`, and `sw.js`. Serve it over HTTPS for the intended PWA experience.

A single-file test build can optionally be generated with `build.js` for local mobile testing; it is not the primary deployment target.

See the [project documentation](docs/) for:
- [Game rules and development policy](docs/HANDOVER.md)
- [Architecture and deployment](docs/ARCHITECTURE.md)
- [Versioning and releases](docs/VERSIONING.md)
- [Change history](docs/HISTORY.md)

See [LICENSE](LICENSE) for licensing details.
