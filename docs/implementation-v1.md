# DrawStacks v1 — Engineering handoff

## Boundaries

Next.js App Router serves an English React client and a Node-only JSON API. The SQLite database is single-host local storage. The browser is never authoritative for the secret word, solve credit, attempt balance, floor order, eligibility, comment access or like attribution.

No sample stacks are inserted on normal startup. All test state is isolated. Self-hosted fonts keep the app free of runtime Google Fonts requests.

## Persistence model

| Table | Responsibility / constraints |
| --- | --- |
| users | Public UUID, nickname, hashed private session token, expiration |
| stacks | Neutral sequential public number, opaque UUID, private word, founder, times |
| floors | Validated original/preview PNGs, author, stack, ordered index; unique author/stack and index/stack |
| guesses | Private normalized guesses; unique player/stack/text, partial unique first correct solve |
| meters | Remaining attempts and server-time recovery anchor per player/stack |
| likes | Unique player/floor, original event time; self-like rejected |
| comments | Plain text, owner and target floor; access requires stack solve or founder |
| publications | Player + idempotency key → original publication result |

Publishing and guessing use `BEGIN IMMEDIATE` transactions. Publishing checks eligibility, the 50-floor cap and expected latest parent before allocating the next floor. New-stack creation and Floor 1 are atomic. Database initialization is idempotent. Future schema changes need explicit migrations before modifying an existing installation.

## API contracts

Mutations need `X-DrawStacks: 1`; browser Origin must match Host. The session cookie is HTTP-only and SameSite=Lax, with Secure on HTTPS. Body streaming is limited to 3 MB. PNG input is capped at 2 MB and validated as 960 × 640, then decoded/re-encoded to remove metadata. Public image URLs contain only opaque floor IDs.

| Method | Route | Result |
| --- | --- | --- |
| GET / PUT | `/api/me` | Current identity / choose or update nickname |
| GET | `/api/words` | Six suggestions from the 80-word bank, not a stack's chosen word |
| GET / POST | `/api/stacks` | Twelve public stack summaries (offset pagination) / publish a new stack |
| GET | `/api/stacks/:id` | Public floors and only the requesting player's private solve/attempt state |
| POST | `/api/stacks/:id/guess` | Correct/duplicate flags plus fresh requester-specific state |
| POST | `/api/stacks/:id/draw` | Publish relay with `parent`, `image`, `key` |
| GET | `/api/floors/:id/image?preview=1` | Immutable PNG thumbnail; omit query for original |
| PUT | `/api/floors/:id/like` | Set explicit boolean `liked`, safe to retry |
| GET / POST | `/api/floors/:id/comments` | Read/post authorized plain-text comments |
| DELETE | `/api/comments/:id` | Owner-only deletion |
| GET | `/api/leaderboards?tab=stacks\|guessers\|artists` | All-time top 20 and current player's rank where relevant |
| GET | `/api/users/:id/contributions` | Public authored floors, never secret answers or guesses |

Client errors use `{error: "readable message"}`. Expected statuses: 400 invalid content, 401 missing session, 403 denied, 404 missing, 409 publication conflict, 413 oversized body, 429 wait/refill or comment throttling. Do not replace this with client-only authorization.

## Draft and canvas behavior

The visible canvas is always backed by a 960 × 640 transparent bitmap on a white sheet. Erasing uses `destination-out`, not white paint. Flood fill respects connected premultiplied pixel colors and tolerance. Selection copies raster pixels, clears the old region and moves the selected rectangle. Geometry/zoom do not change export resolution.

Undo stores up to 51 compressed snapshots (initial state plus 50 actions); history is intentionally session-local. Draft JSON stores the current PNG, private word, publication key, expected parent. Keys are separated by user and stack. Completed strokes and setting the word save immediately. Failed storage is displayed and `Save & exit` is blocked; users should not navigate away when warned.

Pencil defaults to 8 px/100%; marker to 16 px/45%. Each remembers its own width/opacity during an editor session. Color is shared. Eraser has a separate 4–80 px width. Brush/marker settings are not restored across page reloads. The fixed canvas supports mouse, stylus and touch pointers; there is no pressure-sensitive pen model in v1.

## Ranking / attempts

Attempt recovery uses server timestamps. The client displays a countdown using a server-clock offset and elapsed local time; the next request always rechecks server state. Identical normalized wrong guesses do not spend another try. After all tries are consumed, wait for recovery before any further guess. Correct guesses consume none and only the first counts.

Rankings are calculated from persisted current data, not client counters. Scores descending; ties use the earliest latest contributing event, then stable UUID. Unlikes remove artist points. Self-likes and founder self-solves are rejected. Public deployment needs durable accounts/rate limits to resist additional-cookie identities.

## Operational limits and next work

- Single server with persistent disk. Ephemeral/serverless filesystems are not a suitable deployment unchanged.
- No authentication recovery, moderation, public write quotas for nickname/stack creation, or competitive anti-cheat. Comments have a 10/min/player cap; other abuse controls are future work.
- Stack updates are manual refresh. No WebSocket presence or live editor synchronization.
- Comments currently return the first 200 per floor; contribution previews return the latest 100. Add pagination before large-scale usage.
- Stop the server before taking a plain-file backup. Do not delete live databases to reset tests; test runners already isolate their data.
- Browser and visual verification status must be read from the root QA report. Automated tests are not a substitute for real phone/LAN device playtests.
- CI can run `npm ci`, typecheck, tests, build, HTTP tests and (after installing Chromium) browser tests. No deployment workflow or remote write credentials are stored in the repo.
