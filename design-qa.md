# DrawStacks v1 — Implementation acceptance

final result: blocked

## Latest functional change — custom accepted answers

The creator now enters comma-separated accepted answers instead of using the original mockup's word suggestions. This is an explicit user-directed behavior change, not an unintended visual difference. The interface remains English; player content may use any language. The old editor mockup no longer specifies the answer-entry form.

Current verification: 16 unit tests and the real HTTP integration test pass, including `ELON MUSK` and `马斯克` with separate players, exact phrase matching, input validation, privacy and persistence. TypeScript and production build also pass. Updated browser tests cover custom input, invalid separators, unfinished draft recovery and the existing game flow; they have not been run. The previous browser acceptance blocker below is unchanged.

## Visual truth and intended comparison

- Sources: `docs/design/home.png`, `docs/design/stack-detail.png`, `docs/design/drawing-editor.png`, `docs/design/leaderboards.png`, plus the behavior corrections in `docs/design-v1.md`.
- Source images: 1487 × 1058 px. Intended desktop CSS viewport 1487 × 1058, device scale factor 1. Additional phone viewport: 390 × 844.
- Intended states: populated home, wrong guess with four tries remaining, selected-word editor, populated ranking. The normal production database starts empty; comparisons must use isolated test state, not fabricated production scores.
- Sources were opened and inspected. **No rendered implementation screenshot is available yet.** Browser interaction suite and capture paths are prepared in `tests/browser/game.spec.ts`; those paths are not evidence until a run actually generates them.

## Blocker

The connected browser tool returned no browsers and `nodeRepl.fetch request failed`. A request was sent to the user for permission to run an independent Playwright test browser. Until that permission arrives (or the normal browser connection works), do not run that alternate browser or claim browser/visual acceptance.

The image-to-code / design-qa workflow requires rendered source-versus-implementation comparison. HTTP health and production compilation do not satisfy that gate. This report intentionally remains blocked rather than claiming visual equivalence from code.

## Verified without a browser

- TypeScript typecheck.
- Initial release: 12 game/paint unit tests; latest suite: 16. Coverage includes private sessions/answers, custom answer validation/matching, attempts and server-time refill, duplicate handling, one-floor eligibility, parent conflicts, image validation, like attribution, comments/ownership, floor cap, ranking ties, connected fill and persistence after database reopen.
- Production compilation with Next.js.
- Real HTTP integration on an isolated database: two players publish, guess, solve, relay, like, comment/delete, rank and fetch PNGs; anonymous/forged identity/cross-site writes denied.
- Prettier format check and runtime dependency audit (zero known vulnerabilities at check time).
- Local HTTP responses from the application. This is not a GUI playtest.

## Required fidelity surfaces — still pending rendered evidence

- Fonts/typography: Patrick Hand and Nunito are self-hosted. Verify actual fallback-free rendering, heading scale and wrapping.
- Spacing/layout rhythm: inspect 3/2/1 card grid, drawing/guess regions, bottom editor settings, mobile ordering and overflow.
- Colors/tokens: cream/white/charcoal palette and blue/coral/green state cues implemented; verify rendered contrast and disabled controls.
- Image quality: real player PNGs preserve aspect ratio; Phosphor provides UI icons. Compare actual thumbnails/export quality. Mockup drawings are illustrative, not seeded production assets.
- Copy/content: English UI and real empty/loading/error/success states implemented. Verify that wrapped labels remain legible on phones.

## Comparison history

No completed visual comparison. No full-view or focused-region comparison evidence exists yet; no P0/P1/P2 visual issue has been closed on screenshot evidence. No browser console-error check is claimed.

## Next acceptance steps

1. With permission, run `npx playwright install chromium`, then `npm run build` and `npm run test:browser`.
2. Inspect actual captures under `test-results/qa/`. Place source and implementation images together at matched viewport/state for full-view and focused-tool/guess-panel comparisons. Record intentional differences in dynamic player content.
3. Fix functional failures and P0/P1/P2 design findings, rerun and recapture. Add exact evidence paths and results here. Preserve real test failures instead of changing assertions merely to pass.
4. Verify mobile controls, console errors, draft recovery after network failure and touch interactions, plus real two-device LAN play.
5. Change `final result` to `passed` only after the required evidence and comparisons exist. Public hosting remains a separate decision.
