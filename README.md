# DrawStacks

An English-language drawing, guessing, and relay game: **Draw. Guess. Build together.**

## Current status

The first-version design is ready for implementation. This repository contains product specifications and visual mockups; it does not yet contain a playable application.

- [First-version design and acceptance scenarios](docs/design-v1.md)
- [Change history and development handoff](CHANGELOG.md)
- [Contribution instructions](AGENTS.md)
- [Mockup generation brief](docs/design-prompts.md)

## Design screens

### Home

![Home](docs/design/home.png)

### Stack detail and wrong-guess feedback

![Stack detail](docs/design/stack-detail.png)

### Drawing editor

![Drawing editor](docs/design/drawing-editor.png)

### Leaderboards

![Leaderboards](docs/design/leaderboards.png)

Mockups illustrate the design direction. The written specification defines interactions, ranking rules, and the corrections needed where individual image details differ.

## Next implementation milestone

Validate the editor's brush, eraser, fill, undo, and draft capabilities; then implement the local/LAN drawing–guessing–relay loop. Add floor-level comments, likes, sharing, and the three rankings. Revalidate dependencies before selecting versions.

## Team handoff

Before working, synchronize the current branch and read the latest changelog. Each development change must include a changelog entry describing changes, verification, limitations, and the next handoff. Commit and push the relevant code and documentation together; verify remote synchronization before reporting completion. Never commit credentials or live player data.
