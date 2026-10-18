# Jester & Moat

A 10x8 chess variant by Mikael Lagersson. Built as a PWA - installable and
fully playable offline. MIT licensed.

## The game

- **Board**: 10 columns x 8 rows, files A-J.
- **New piece - the Jester**: slides like a queen up to 3 squares, and can swap
  places with an adjacent friendly piece that has already moved.
- **Moats**: 1x3 barriers placed mid-game; sliding pieces stop at them,
  knights jump over. Two enemy pieces on a moat destroy it.

## Features

- AI opponent (minimax with alpha-beta pruning, Web Worker with fallback)
- Chess clocks, undo/redo, board editor
- JSON save/load, auto-play, light/dark themes
- Installable PWA with offline support

## Project docs

See the `docs/` folder for agent rules, game rules, architecture notes and
known platform limitations.
