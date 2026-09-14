# DrawStacks v1 — Engineering handoff

## Boundaries

Next.js App Router serves an English React client and a Node-only JSON API. The SQLite database is single-host local storage. The browser is never authoritative for the secret word, solve credit, attempt balance, floor order, eligibility, comment access or like attribution.

No sample stacks are inserted on normal startup. All test state is isolated. Self-hosted fonts keep the app free of runtime Google Fonts requests.

## Persistence model

| Table | Responsibility / constraints |
| --- | --- |
| users | Public UUID, nickname, hashed private session token, expiration |
| stacks | Neutral sequential public number, opaque UUID, founder, times; legacy `word` mirrors Floor 1 for compatibility |
| floors | Validated original/preview PNGs, artist, stack, ordered index, private comma-separated answers and a public hint; unique index/stack |
| floor_guesses | Floor-scoped normalized guesses; wrong guesses are public, while the one correct solve reveals only after success |
| floor_meters | Remaining attempts and server-time recovery anchor per player/floor |
| notifications | Correct-solve alerts for the drawing artist, including read state |
| likes | Unique player/floor, original event time; self-like rejected |
| comments | Plain text, owner and target floor; public after that floor is solved, privately available to its artist beforehand |
| publications | Player + idempotency key → original publication result |

Publishing and guessing use `BEGIN IMMEDIATE` transactions. Publishing checks eligibility, the 50-floor cap and expected latest parent before allocating the next floor. New-stack creation and Floor 1 are atomic. Database initialization is idempotent and deferred until the first API request, so `next build` never opens the mounted production database while the live service is using it. Future schema changes need explicit migrations before modifying an existing installation.

## API contracts

Mutations need `X-DrawStacks: 1`; browser Origin must match Host. The session cookie is HTTP-only and SameSite=Lax, with Secure on HTTPS. Body streaming is limited to 3 MB. PNG input is capped at 2 MB and validated as 960 × 640, then decoded/re-encoded to remove metadata. Public image URLs contain only opaque floor IDs.

| Method | Route | Result |
| --- | --- | --- |
| GET / PUT | `/api/me` | Current identity / choose or update nickname |
| GET / POST | `/api/stacks` | Twelve public stack summaries (offset pagination) / publish a new stack |
| GET | `/api/stacks/:id` | Public floors, hint and wrong-guess list plus requester state; answers appear only to the artist/solver or after reveal |
| POST | `/api/stacks/:id/guess` | Correct/duplicate flags plus fresh requester-specific state |
| POST | `/api/stacks/:id/draw` | Winner publishes relay with `parent`, new `word` answers, public `hint`, `image`, `key` |
| GET | `/api/floors/:id/image?preview=1` | Immutable PNG thumbnail; omit query for original |
| GET | `/api/share-card/:floorId` | Public spoiler-free 1200 × 630 social preview PNG |
| PUT | `/api/floors/:id/like` | Set explicit boolean `liked`, safe to retry |
| GET / POST | `/api/floors/:id/comments` | Read/post authorized plain-text comments |
| DELETE | `/api/comments/:id` | Owner-only deletion |
| GET | `/api/leaderboards?tab=stacks\|guessers\|artists` | All-time top 20 and current player's rank where relevant |
| GET | `/api/users/:id/contributions` | Public authored floors, never secret answers or guesses |
| GET / PUT | `/api/notifications` | Current player's solve alerts / mark all read |

Client errors use `{error: "readable message"}`. Expected statuses: 400 invalid content, 401 missing session, 403 denied, 404 missing, 409 publication conflict, 413 oversized body, 429 wait/refill or comment throttling. Do not replace this with client-only authorization.

### Custom accepted answers (supersedes the word bank)

`POST /api/stacks` retains the compatible `word` field and accepts user-written English-comma-separated answers, e.g. `ELON MUSK,马斯克`. Every new floor also requires a public `hint` of 1–160 characters. `src/lib/answers.ts` shares answer validation between browser and server: 1–10 distinct entries, 80 characters per entry, 809 input characters total; trim/collapse whitespace, NFC normalization and case-insensitive deduplication while preserving first-entry spelling. Empty entries, full-width comma separators and control characters are rejected with English messages. `/api/words` is removed (404); there are no built-in aliases or suggestions.

Guesses must match one complete normalized entry; do not split a submitted guess into multiple guesses or accept substrings. Each floor owns its answer list and public hint. Server response `word` describes only the latest floor and is null for unsolved viewers other than its artist; revealed floor rows expose their own `answers`. Incorrect guesses return publicly with the guesser's nickname so the group can see what has already been tried. Correct guesses never appear before the solve reveal. The first correct guess atomically locks the right to publish the next floor, reveals the accepted answers, creates a public solve event and alerts the artist. Further guesses against that solved floor are rejected while the winner draws.

The startup migration adds per-floor answers, public hints, guesses, attempt meters and notifications, copies each legacy stack answer to its existing floors, and removes the former unique artist/stack restriction. Existing floors receive an empty hint and remain readable; every new publication requires one. Legacy solve/attempt tables remain for compatibility and are migrated without deleting player data. This permits A → B → C → A relays while keeping unique floor order and stale-parent checks.

Drafts retain the compatible `word` field and add `answerInput` plus `hint` for unfinished edits; older drafts restore and prompt for the now-required hint. All interface copy remains English, including validation; user-entered answers and hints can use other languages. Never include private answer lists in public titles, previews, lists, rankings or share text.

### Social sharing

Selected-floor pages emit Open Graph and X `summary_large_image` metadata. The dynamic editorial card contains only public floor art, stack/floor numbers, artist nickname and neutral invitation copy; its renderer must never query guesses or answers. The home page uses a separate opaque RGB JPEG 1200 × 630 brand card. Metadata declares each card's MIME type, card responses cache publicly for at least 24 hours, and the generated `/robots.txt` explicitly allows Twitterbot. SVG and 32/96 px PNG favicon assets are linked from the root metadata. `src/lib/share.ts` owns canonical floor paths and platform intent encoding. The X action opens `https://x.com/intent/tweet` in a new browsing context, so the player reviews and submits the post on X; no X token is collected.

Use `DRAWSTACKS_PUBLIC_URL` in hosted/proxied environments. Without it, metadata derives the request origin. Social crawlers cannot reach localhost or private LAN origins. Future platform buttons should be adapters around the same canonical URL and metadata, with the native Web Share API remaining the device-level fallback. OAuth posting APIs are a separate, explicit-consent feature and must not reuse the anonymous game cookie as social authorization.

## Draft and canvas behavior

The visible canvas is always backed by a 960 × 640 transparent bitmap on a white sheet. Erasing uses `destination-out`, not white paint. Flood fill respects connected premultiplied pixel colors and tolerance. Selection copies raster pixels, clears the old region and moves the selected rectangle. Geometry/zoom do not change export resolution.

Undo stores up to 51 compressed snapshots (initial state plus 50 actions); history is intentionally session-local. Draft JSON stores the current PNG, private accepted answers and unfinished answer input, publication key, expected parent. Keys are separated by user and stack. Completed strokes and answer edits save immediately. Failed storage is displayed and `Save & exit` is blocked; users should not navigate away when warned.

Pencil defaults to 8 px/100%; marker to 16 px/45%. Each remembers its own width/opacity during an editor session. Color is shared. Eraser has a separate 4–80 px width. Brush/marker settings are not restored across page reloads. The fixed canvas supports mouse, stylus and touch pointers; there is no pressure-sensitive pen model in v1.

## Ranking / attempts

Attempt recovery uses server timestamps. The client displays a countdown using a server-clock offset and elapsed local time; the next request always rechecks server state. Identical normalized wrong guesses do not spend another try. After all tries are consumed, wait for recovery before any further guess. Correct guesses consume none and only the first counts.

Rankings are calculated from persisted current data, not client counters. Scores descending; ties use the earliest latest contributing event, then stable UUID. Unlikes remove artist points. Self-likes and founder self-solves are rejected. Public deployment needs durable accounts/rate limits to resist additional-cookie identities.

## Operational limits and next work

- Single server with persistent disk. Ephemeral/serverless filesystems are not a suitable deployment unchanged.
- No authentication recovery, moderation, public write quotas for nickname/stack creation, or competitive anti-cheat. Comments have a 10/min/player cap; other abuse controls are future work.
- Home, open stacks, solve activity and notifications poll every 3–5 seconds while visible. There is no WebSocket presence or live editor synchronization.
- The first correct solver owns the next publication opportunity. V1 has no timeout or reassignment if that player abandons the draft.
- Comments currently return the first 200 per floor; contribution previews return the latest 100. Add pagination before large-scale usage.
- Stop the server before taking a plain-file backup. Do not delete live databases to reset tests; test runners already isolate their data.
- Browser and visual verification status must be read from the root QA report. Automated tests are not a substitute for real phone/LAN device playtests.
- CI can run `npm ci`, typecheck, tests, build, HTTP tests and (after installing Chromium) browser tests. No deployment workflow or remote write credentials are stored in the repo.
