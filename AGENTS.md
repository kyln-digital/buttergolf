# Project: buttergolf

## Release model (deploy ≠ merge)

- `main` is integration: merging a PR to `main` produces a **preview deploy only**. It never touches production.
- `production` is the release branch: the Vercel Production Branch points at it. Production deploys **only** when `main` is promoted (merge / fast-forward `main` → `production`).
- Promotion is an explicit, human-gated action. **Never** push, merge, or open auto-merging PRs targeting `production`.
- Database migration safety is assessed at promote time, not merge time.
