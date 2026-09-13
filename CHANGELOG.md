# Changelog

## 2026-09-13 — X sharing and spoiler-free social cards

- Added a dedicated **Share on X** action using X's user-confirmed Web Intent. The selected floor URL and English invitation are prefilled; DrawStacks never posts on a player's behalf or needs X credentials for this flow.
- Added a dynamic 1200 × 630 DrawStacks share card for every floor: cream paper, blue/yellow brand accents, the real drawing, stack/floor identity, artist attribution and a guessing call to action. Secret answers and private guesses are never rendered into the card.
- Added per-floor Open Graph and `summary_large_image` metadata so X and other compatible social crawlers can display the card. Added `DRAWSTACKS_PUBLIC_URL` support for a stable public origin behind a proxy or custom domain.
- Centralized selected-floor paths, English share copy and encoded X Intent construction in `src/lib/share.ts`, leaving a small adapter boundary for later Telegram, WhatsApp, Facebook and native device sharing.
- Verification: share URL unit coverage, TypeScript, formatting, production build and HTTP tests cover 1200 × 630 PNG rendering plus page metadata. Browser interaction remains pending because the connected browser provider is unavailable.
- Handoff: social cards require a publicly reachable HTTPS deployment; localhost/LAN URLs cannot be fetched by X. Before adding each network, recheck its current official share-dialog requirements. Instagram-style direct posting needs a separately authorized platform/API flow or native share-sheet handoff.
- Synchronization status: the GitHub connection is still timing out on port 443, so this iteration and the preceding local commit await a normal, non-forced push. The failure occurred before any remote write; retry after connectivity returns and verify remote `main` afterward.

## 2026-09-13 — Per-floor answers, solve reveals and live activity

- Changed the relay contract so every artist privately defines 1–10 accepted answers for their own floor. The first correct solver must set a new answer list before drawing the next floor; answers never carry forward automatically. Artists may return later in an A → B → C → A relay.
- Scoped guesses, five-try recovery and solve credit to the latest floor. The first correct solve locks the next drawing opportunity; later guesses are rejected because the answer has already been revealed.
- Added an automatic public solve activity card showing the solved drawing, winner's exact guess and the artist's complete accepted-answer list. Added an in-app notification bell for artists, unread counts and mark-read behavior.
- Added visible-page polling for home stacks, stack state, floor activity and notifications so another player's solve or publication appears without a manual refresh. This is 3–5 second near-real-time polling, not WebSocket push.
- Added an idempotent SQLite migration that copies legacy stack answers to floors, introduces floor-scoped guesses/meters and notification storage, and removes the old one-floor-per-artist constraint without resetting player data.
- Verification: formatting, TypeScript, production build, one real HTTP integration test and 17 unit/migration tests passed. Coverage includes answer privacy, case-insensitive multilingual matching, public reveal events, artist notifications, first-solver locking, required next-floor answers, alternating artists, persistence and foreign-key integrity. Browser scenarios were updated but not executed; the existing browser QA limitation remains.
- Handoff: browser-test the notification popover, solve card, short-poll updates and A → B → C → A flow when an automated browser is available. V1 has no timeout/reassignment if the winning solver abandons the next-floor draft. Source, migration, tests, docs and this log must be committed and pushed together; no runtime database is included.
- Synchronization status: the feature is committed locally, but repeated GitHub HTTPS/HTTP 1.1 push attempts failed with connection resets/timeouts on 2026-09-13. Upload and remote-HEAD verification remain pending; retry a normal, never forced, `git push origin main` when GitHub connectivity returns.

## 2026-09-13 — Creator-defined multilingual accepted answers

- Removed the built-in word bank, automatic synonyms, suggestion picker and `/api/words` endpoint. Creators now enter their own comma-separated words/phrases in an English **Accepted answers** form.
- Matching any one complete entry wins: `ELON MUSK,马斯克` accepts either `elon musk` or `马斯克`. Matching ignores case, extra whitespace and canonical Unicode differences; partial names, unspecified synonyms and batches of guesses do not count.
- Shared browser/server validation supports 1–10 distinct entries of up to 80 characters each (809 input characters total), combines duplicates and rejects blank entries/full-width separators with English guidance. The guess input limit now matches the per-answer limit.
- Preserved private answers, one counted solve, attempt recovery and the immutable relay answer list. The existing database `word` field and older single-answer drafts remain compatible; no player database reset or rewrite. Previously implicit word-bank aliases are no longer accepted unless explicitly listed; existing solve records remain valid.
- Added editable-answer draft autosave, unfinished input restoration and cancel-edit behavior. Updated all affected instructions, success text, sharing copy and metadata in English. Non-English text is allowed as user content, not interface chrome.
- Verification: 16 passing unit tests and one passing real HTTP integration test, covering both example answers with separate players, normalization, invalid input, privacy, unchanged relay answers and persistence; TypeScript and production build passed. Browser test cases were updated but not executed: the previously documented browser verification/permission gap remains.
- Handoff: test custom-answer entry/edit/reload and narrow-screen wrapping in the browser when available. Setup and architecture docs reflect the new contract. Source, tests and log are committed together; no runtime data is included.
- Synchronization status: the initial push was interrupted by a temporary GitHub connection failure; the retry succeeded in follow-up commit `e28ffa0` and remote `main` was verified.

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
