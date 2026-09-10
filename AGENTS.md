# Project: buttergolf

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:

- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

## Release model (merge = deploy)

- Vercel's Production Branch is `main`. Merging a PR to `main` deploys **straight to production**. There is no separate `production` branch and no promotion step.
- Every PR branch gets its own Vercel **preview** deploy. Verify UI and behaviour changes on the preview before merging.
- Merging is therefore the release decision: merge only when CI is green and the preview has been checked, and only when asked to.
- Database migrations are not run by the build (`turbo run build` depends on `db:generate` only; `prisma migrate deploy` is a separate, deliberate step). Assess migration safety **before** merging, and apply the migration to production as part of the same release.
