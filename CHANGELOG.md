# Changelog

## 2026-09-13 — Creator-defined multilingual accepted answers

- Removed the built-in word bank, automatic synonyms, suggestion picker and `/api/words` endpoint. Creators now enter their own comma-separated words/phrases in an English **Accepted answers** form.
- Matching any one complete entry wins: `ELON MUSK,马斯克` accepts either `elon musk` or `马斯克`. Matching ignores case, extra whitespace and canonical Unicode differences; partial names, unspecified synonyms and batches of guesses do not count.
- Shared browser/server validation supports 1–10 distinct entries of up to 80 characters each (809 input characters total), combines duplicates and rejects blank entries/full-width separators with English guidance. The guess input limit now matches the per-answer limit.
- Preserved private answers, one counted solve, attempt recovery and the immutable relay answer list. The existing database `word` field and older single-answer drafts remain compatible; no player database reset or rewrite. Previously implicit word-bank aliases are no longer accepted unless explicitly listed; existing solve records remain valid.
- Added editable-answer draft autosave, unfinished input restoration and cancel-edit behavior. Updated all affected instructions, success text, sharing copy and metadata in English. Non-English text is allowed as user content, not interface chrome.
- Verification: 16 passing unit tests and one passing real HTTP integration test, covering both example answers with separate players, normalization, invalid input, privacy, unchanged relay answers and persistence; TypeScript and production build passed. Browser test cases were updated but not executed: the previously documented browser verification/permission gap remains.
- Handoff: test custom-answer entry/edit/reload and narrow-screen wrapping in the browser when available. Setup and architecture docs reflect the new contract. Source, tests and log are committed together; no runtime data is included.
- Synchronization status: initial fetch/push and an HTTP/1.1 retry failed with connection resets / inability to connect to github.com:443. Feature commit `72b131e` is preserved locally; upload and remote verification remain pending. Retry a normal (never forced) push when connectivity returns.

## 2026-09-13 — First playable local/LAN game

- Implemented the English cream/hand-drawn Home, stack detail, new/relay Canvas editor and three leaderboards using Next.js, React, locally served Patrick Hand/Nunito fonts and Phosphor icons.
- Added server-backed nickname sessions, 80 curated words/aliases, transactional publishing, neutral public stack numbers, private guessing, five tries with server-time recovery, one contribution per player/stack, and 50-floor completion.
- Added pencil/marker width and opacity, palette/custom HEX, true pixel erasing, connected fill/tolerance, line/rectangle/ellipse, constrained shapes, rectangular selection/move/delete, 50-action undo/redo, confirmed clear, zoom/fit/pan and keyboard shortcuts.
- Added device-local draft recovery and save-failure warnings; publication retries are idempotent. Conflicting relays preserve drafts and allow review of the newest floor. Published art and statistics persist in SQLite across server restarts.
- Added floor-specific likes, spoiler-protected comments, owner-only comment deletion, selected-floor sharing, ranking tie-breaks/current-player rank and author contribution previews. Unsolved responses never expose the word or a joinable word ID.
- Replaced outdated framework/editor assumptions with the installed supported framework and a custom raster Canvas. Used Node's built-in SQLite after the external native SQLite package required unavailable Windows compilation prerequisites; that package was removed.
- Validation performed: TypeScript check; 12 passing game/paint/persistence tests; passing real HTTP two-player integration test (including permission checks); production build; formatting check; dependency audit with zero known runtime vulnerabilities. Test databases are separate from normal game data.
- Added a Playwright suite for drawing gestures, drafts, two-player gameplay, social actions, sharing, rankings and desktop/mobile captures. **Not run yet:** alternate browser execution awaits user approval; the connected browser still reports `nodeRepl.fetch request failed`. `design-qa.md` is explicitly blocked. GUI behavior/visual fidelity and physical LAN-device play are not claimed as verified.
- Handoff: complete browser/visual acceptance first, then a real LAN playtest. Public launch additionally needs hosting with durable storage, accounts/abuse controls and moderation. No deployment, fabricated live activity, user data or credentials are included in this change.
- Collaboration: README and architecture/setup notes now document how coworkers run, test, back up and extend the app. This code and its known QA limitation are committed together; use Git history/remote HEAD to verify synchronization.

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
