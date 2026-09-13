# DrawStacks — First-version design

Design revision: 2026-09-13. Status: first local/LAN implementation added. See [implementation notes](implementation-v1.md) and [QA status](../design-qa.md) for actual verification and remaining limitations.

## Product direction

An English-language drawing, guessing, and relay game. Players explore stacks, solve the latest drawing, set a new private answer, then add the next floor. The first release is a local/LAN Web prototype, with public hosting as a separate later step.

The user's latest requests override the older reference documents: use warm cream and playful hand-drawn styling instead of neon; use English throughout; include a home page, complete drawing controls, comments, likes, sharing, visible incorrect guesses, and three leaderboards.

The attached Neal.fun screenshot is a visual reference only. Use original DrawStacks branding and assets.

## Screens

| Screen | Route | Main job | Design |
| --- | --- | --- | --- |
| Home | `/` | Choose someone else's stack or start one | [Home](design/home.png) |
| Stack detail | `/stacks/:id` | View floors, guess, react and join the relay | [Stack detail](design/stack-detail.png) |
| New stack / relay editor | `/new`, `/stacks/:id/draw` | Enter accepted answers when opening a stack; draw and publish | [Drawing editor](design/drawing-editor.png) |
| Leaderboards | `/leaderboards` | Explore three rankings | [Leaderboards](design/leaderboards.png) |

These are four screens of one design, not alternatives. Mockup counts are illustrative and are not real activity. The specifications below govern behavior when image details differ.

Latest user revision: every floor's artist writes a private comma-separated accepted-answer list for that floor. All UI labels remain English; player answers can be multilingual. A correct solve publishes the winning guess and artist's complete answer list, notifies the artist, and gives the winner the next drawing opportunity.

## Core loop and rules

1. Browse stacks without creating an account. Before guessing, drawing, liking or commenting, choose a nickname in a small dialog. Return to the interrupted action afterward.
2. Start a stack: write your own accepted answers, separated by English commas, then draw the first floor. Words, phrases and translations in any language are allowed, e.g. `ELON MUSK,马斯克`. There is no word bank or suggestion refresh.
3. Publish: create both the stack and Floor 1 together. A draft does not appear on the homepage.
4. Visit a stack: open the latest floor, with access to earlier floors. Each floor is a new prompt with its own private answer list.
5. Incorrect guess: show a coral cross, `Not quite! Try again.`, reduce the remaining attempts by one, and retain the guess in the player's private history.
6. Correct guess: the first solver wins the next drawing opportunity. Reveal the solved drawing, exact winning guess and full accepted-answer list in a public activity card, notify its artist, and show `Draw the next floor` to the winner.
7. Relay: the winner must enter new accepted answers before drawing. The previous floor remains a collapsible reference. Publishing adds the new private prompt and returns everyone to the latest floor.

Proposed first-version defaults, chosen to resolve conflicting older documents:

- One artist-defined answer list per floor. Matching any one complete answer wins. Use 1–10 distinct entries, each at most 80 characters, separated by English commas (809 input characters total). Reject empty entries/full-width separators, deduplicate normalized answers, and preserve the original display spelling.
- Five attempts per player per floor; recover one attempt every 60 seconds, capped at five. A correct answer consumes no attempt. Server time governs recovery; show `Next try in 00:42` when useful.
- Empty input, connection failures and an identical repeated wrong guess do not consume attempts. Normalize case, Unicode NFC and surrounding/repeated whitespace. Accept only the creator's explicit answers, not automatic synonyms, substrings, fuzzy guesses or comma-separated batches of guesses.
- Only the first successful solve of each floor counts and receives the next drawing opportunity. Artists cannot solve their own current drawing. Other guesses stop after the reveal.
- An artist may contribute again after other players extend the stack. Leaving the editor preserves the winner's draft and does not spend the opportunity.
- Fifty published floors complete a stack. Completed stacks remain viewable, guessable, likeable and commentable, but cannot receive another floor.
- No forced timer or automatic publication in v1. Publish is always an explicit action.

## Home

- Shared header: original `DRAWSTACKS` wordmark, `Stacks`, `Leaderboards`, and nickname control.
- Title: `Every drawing builds a story.` Supporting sentence: `Pick a stack, guess the word, and draw the next floor.`
- Primary action: `+ Start a stack`.
- Three-column desktop grid, two columns on tablet, one on phones. A stack is represented by slightly offset drawing sheets, with its latest drawing prominent.
- Show public stack number, published floor count, founding author, and total likes across its floors. Default ordering is most recently published floor first; use `Load more` after the initial batch.
- Default titles are `Stack #024`, not the secret word. A free-text title field is omitted from v1 to avoid obvious answer leaks.
- State-specific action labels: unsolved `Guess this stack`; current floor's winner `Draw next floor`; current artist `View this stack`; completed `View completed stack`.
- Poll the latest previews and state every five seconds while Home is visible so remote publications appear without refresh.
- Empty state: `The first stack starts with you.` Loading skeletons match the sheet layout. Loading failure has a `Try again` action.

## Stack detail and answer states

The desktop page places floor navigation and the drawing to the left, with guessing to the right. Below the drawing are the selected floor's author, likes, comments and share action. `View all floors` expands a chronological overview; it does not load 50 live editors.

| Viewer state | Visible controls and feedback |
| --- | --- |
| Guest, unsolved | Input, Guess, remaining attempts, own history; answers hidden |
| Incorrect | Coral cross and text, consumed dot faded; own wrong guess remains visible |
| No attempts | Disabled submit, recovery countdown, `Explore other stacks`; input text preserved |
| Correct, eligible | Green confirmation, revealed answers, `Draw the next floor` |
| Current artist | Private accepted answers; `Waiting for a guess`; no self-guess |
| Solved by someone else | Public solve card and answers; wait for the winner to publish |
| Completed stack | `This stack is complete!`; eligible visitors can still solve |

The initial implementation should show errors persistently until the next attempt or input edit, rather than disappearing before players can read them. Announce success/errors to assistive technology and never rely solely on color. Pressing Enter submits a guess once; disable duplicate in-flight submissions.

## Drawing editor

Use the same editor for opening and relaying. Both flows begin with a blank private `Accepted answers` form. The English-labeled input explains comma-separated alternatives, and `Save answers & draw` validates them before drawing. A relay also shows the previous floor reference toggle, but never copies its answers. Unfinished input is included in local drafts. Drawing itself occupies most of the workspace.

| Tool / setting | First-version behavior |
| --- | --- |
| Pencil | Solid round freehand strokes; default 6 px, charcoal |
| Marker | Wider freehand strokes; default 16 px; its own opacity setting |
| Stroke size | Slider 1–40 px, numeric value, Thin / Medium / Thick presets |
| Colors | Ten preset colors, custom color picker, HEX entry; selected swatch visibly outlined |
| Opacity | 10–100%; preview current stroke appearance |
| Eraser | Pixel eraser 4–80 px, circular cursor preview; settings replace brush settings while selected |
| Fill | Bucket fills connected regions on the current drawing; tolerance setting and undo support |
| Shapes | Line, rectangle, ellipse; use current color and width; Shift constrains geometry |
| Selection | Select a region, move it, or delete it; show clear selection boundary |
| Undo / redo | At least 50 drawing actions, including erasing, fill, moves and clearing |
| Clear | Confirmation dialog; clearing can also be undone |
| Zoom / pan | 25–200%, Fit; Space-drag pans; zoom never changes the saved composition |
| Draft | Autosave changes on this device; `Save & exit`; visible Saved / Saving / Save failed state |
| Publication | Reject an empty drawing, show a progress state, prevent double publication and retain drafts on failure |

Shortcuts: B pencil, M marker, E eraser, G fill, V select, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, [ and ] size. Do not intercept shortcuts while typing in inputs. Provide hover tooltips with name and shortcut; touch targets at least 44 px.

No text tool or external image import in v1. Manual writing cannot be completely prevented without additional moderation.

Social actions appear below published art. In a brand-new draft they are disabled and labeled `Available after publishing`. After publishing, the page opens the new floor with active actions. Relay editors may show the previous published floor's social controls only inside its reference view, clearly attributed to that floor.

## Comments, likes and sharing

- Likes attach to a floor, not directly to the founding author or the whole stack. Each viewer can like a floor once and undo that like. Self-likes do not count and are disabled.
- Homepage heart counts sum valid likes across a stack. Artist ranking sums valid likes on that artist's own floors across all stacks.
- Comments attach to a floor; plain text, 1–300 characters, chronological order, nickname and relative time. Before a solve, only its artist can access them. After the first correct solve they are public, alongside a server-generated solve card containing the picture, exact winning guess and full answer list.
- The solved floor's artist receives a bell notification with an unread count. Opening the menu marks the current notification list read. Stack state, activity and notifications poll while visible for near-real-time updates.
- A user can delete their own comment after confirmation. Raw HTML is never rendered. Requests require the server session; a nickname is not proof of ownership.
- `Share` opens the browser's native share sheet when supported, otherwise copies a link to the selected floor. `Share on X` opens X's editable Web Intent composer. Success text for copying remains `Link copied!`. Never automatically post to a social network.
- Shared pages use a 1200 × 630 card: warm cream background, layered white/yellow drawing sheets on the left, real selected-floor art, DrawStacks wordmark and blue prompt badge on the right, plus `Can you guess this drawing?`. Include stack/floor identity and artist nickname; never include accepted answers, guess history or viewer state.
- Shared title/preview never contains the secret word, the sender's answer state or private guesses. The receiver is evaluated using their own session.
- Localhost links work only on the host computer. LAN play needs the server's reachable LAN address; public links require a separately hosted release.

## Leaderboards

One page with three tabs. Initial period: all time. Top 20 entries per tab; a simple current-player rank summary on user tabs when ranked. Zero-data states encourage the relevant action instead of inventing activity.

| Tab | Entity | Score | Tie-break |
| --- | --- | --- | --- |
| Tallest stacks | Stack | Published floors, including Floor 1 | Earlier last-floor publication, then stable ID |
| Top guessers | Player | Number of first correct floor solves | Earlier time of the latest counted solve, then stable ID |
| Most-loved artists | Player | Current valid likes on all their published floors | Earlier latest counted like, then stable ID |

Stack rows link to the stack. User rows open a lightweight contribution list of that player's published floors; no separate social profile system is required. Likes are attributed to each drawing's actual author. Toggling likes and first-solver locking cannot inflate totals. Rankings refresh on entry and manual refresh.

## Visual system and responsive behavior

- Canvas/page background: warm cream `#FBF4E9`; drawing sheet `#FFFFFF`; text `#343434`; subtle border `#D8CFC3`.
- Primary blue `#2F80ED`; coral `#EA5548`; green `#49AD74`; yellow `#F8BE35`; violet `#8B6BD6`. Use dark text for small labels on pastel colors; verify contrast in implementation.
- Tall hand-drawn headings, readable sans body, no more than two font families. Self-host final fonts for local operation.
- Heading sizes 28–48 px, body 16–18 px, secondary text at least 14 px. Keep handwritten branding restrained so drawing space stays prominent.
- Modest 8–16 px corners, thin borders, flat fills, minimal shadows. No neon, decorative city scenes, background grids or oversized dashboard panels.
- Header and spacing tokens are identical across pages. In final UI the brush settings must reflect the selected tool/color; the concept image's black swatch versus red stroke is illustrative, not a desired state.
- Desktop editor has palette left and active-tool settings right. Below 900 px settings become a bottom sheet; tools form a horizontal scroll row. Phones show drawing first, guess panel below, with usable 44 px controls.
- Preserve full drawing aspect ratio with fit/letterboxing. Avoid horizontal page overflow. Touch drawing must not scroll the page; outside the canvas normal scrolling remains available.
- Follow reduced-motion preference. Loading, disabled, selected and error states have text or icons in addition to color.

## Engineering handoff

Keep the local SQLite / Web architecture from the reference material, but revalidate package versions and editor capabilities before implementation. Existing Excalidraw assumptions do not guarantee pixel erasing, bucket fill or marker behavior; prototype those first. A purpose-built Canvas editor may be a better fit. This document does not claim that integration has been tested.

Model users, stacks, per-floor answers, floor-scoped guesses/attempt state, notifications, floor likes and floor comments. Enforce a unique (player, floor) like and one counted winner per floor. Use transactions for the correct solve and for publishing/assigning the next index. Recheck latest parent, winner eligibility and floor cap at publication. If a concurrent contribution changes the parent, preserve the draft and offer to review the new latest floor before retrying.

Unsolved stack responses must not expose word text, aliases, or a word identifier that can be joined to a public word list. Attempts and successful solves are server-authoritative. Anonymous cookie identities are suitable for a friends/LAN prototype, not robust public competitive rankings.

Persist published drawings on the server and drafts on the local device separately. Persist only accepted drawing data, not arbitrary embedded remote URLs. Set payload and comment length limits. Do not commit the running database, user comments, cookies, secrets or dependency directories.

## Acceptance scenarios

- A publishes a new stack; it appears on Home with Floor 1 and a neutral title.
- B opens it and guesses incorrectly: cross visible, five attempts become four, no answer leaked.
- B guesses correctly: the page publishes a solve card, notifies A, gives B one ranking credit and rejects later guesses for Floor 1.
- B enters a new private answer, draws using size/color/eraser/fill, exits and resumes the draft, then publishes Floor 2 once.
- C solves Floor 2, sets new answers and adds Floor 3. A may later solve Floor 3 and add Floor 4. Polling and server restart preserve and surface all activity.
- A sees their own current drawing's private answers and cannot claim a solve on it.
- Liking B's floor increases B's artist score, not A's. Unlike reverses the change.
- Before a floor is solved, other players cannot read its answers, comments or guesses. Afterward, its correct guess, answers and comments are public by design.
- Share targets the chosen floor without disclosing the answer or sender's private state.
- All three ranking tabs return correct ordering for ties, zero data and repeat interactions.
- Full stacks block further publishing; network errors and stale-parent conflicts preserve drafts.
- Mobile navigation, tool settings and guess input remain reachable; keyboard focus and non-color error cues work.

## Delivery status

Delivered: this behavior specification, four visual mockups, generation brief, and a working Next.js / React / SQLite implementation of the core game, editor, social actions and rankings. Server rules, persistence, HTTP integration and production compilation are tested; browser/visual acceptance is tracked separately in the root QA report. Public hosting and real multi-device LAN playtests are not complete. Consult Git history for synchronization status.

Implementation clarifications: pencil defaults to the mockup's 8 px; marker has independent 16 px / 45% defaults. Opacity spans 5–100%. Smaller screens put settings below the canvas in a responsive panel, rather than a modal bottom sheet. Floor navigation is a scrollable list (horizontal on phones); no separate overview dialog. Completed stack visitors may still guess. Empty/loading copy is adapted to genuine empty-server state. Nickname sessions last 30 days with no account recovery. Comments show an absolute local timestamp. Undo history is not persisted with the draft. These are documented first-release decisions, not unimplemented controls disguised as working UI.
