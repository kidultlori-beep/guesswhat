# Repository collaboration instructions

The user requires every development iteration to include an update log and be uploaded to this GitHub repository so coworkers can inspect and continue the work.

## Before making changes

- Read README.md, docs/design-v1.md, and the most recent CHANGELOG.md entries.
- Inspect git status and remote branch changes. Preserve uncommitted work and do not overwrite others' commits.
- Treat the latest explicit user direction as authoritative over old reference specifications.

## For every development iteration

- Implement the requested scope and verify it in proportion to risk.
- Update CHANGELOG.md with the date, what changed, verification actually performed, unresolved issues, and the next handoff.
- Keep interface text in English; use the cream and hand-drawn design language specified in docs/design-v1.md.
- Stage only relevant reviewed files, commit with a clear message, and push to the repository as the user has requested. Follow branch protection or team branch conventions when present. Never force-push over coworker changes.
- Verify the remote commit before claiming upload succeeded. If credentials, permissions, or network access block synchronization, preserve the work and report the exact blocker.
- Keep README.md and relevant specifications aligned with material behavior or setup changes.
- Do not commit local databases, player data, tokens, .env files, build outputs, or dependency folders.

## Handoff accuracy

- Distinguish designs from functioning code and automated checks from actual multiplayer playtests.
- Do not claim application features or tests are completed merely because they appear in a mockup.
- Deployment is a separate action; a GitHub push does not mean the game is hosted or playable online.
