# Changelog

## 2026-09-13 — First-version design handoff

- Established English-only warm cream/hand-drawn visual direction based on the user's screenshot, superseding earlier neon concepts.
- Designed Home, Stack detail with incorrect-guess feedback, full drawing editor, and three-tab Leaderboards.
- Specified pencil/marker, width, opacity, color picker, pixel eraser, fill, shapes, selection, undo/redo, clear, zoom and draft workflows.
- Added floor-level comments, likes and share behavior, with spoiler protection and ranking attribution.
- Defined proposed v1 defaults for same-word relays, attempt recovery, contribution eligibility, 50-floor completion and concurrency handling.
- Added acceptance scenarios and explicit implementation status in `docs/design-v1.md`.
- Validation: reviewed all four concept images and cross-checked requested features against the specification. Application tests are not applicable; implementation has not begun.
- Handoff: implement editor capability prototype first, then persistence/game loop and social/ranking features. Revalidate dependencies before coding.
- Synchronization setup: authenticated Git access through Git Credential Manager and verified that the remote repository is empty. This handoff is prepared as the initial repository commit.
- Added a repository README, persistent contributor instructions, and ignore rules for runtime data and credentials.
