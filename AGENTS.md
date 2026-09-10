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
- Database migrations are not run by the build (`db:generate` is the only database-related prerequisite of `turbo run build`; the other dependency is upstream package builds). Apply them yourself with `pnpm db:migrate:deploy`, which reads `DATABASE_URL` from `packages/db/.env` (see `packages/db/prisma.config.ts`). Point that file at the **production** database first with `vercel env pull packages/db/.env --environment=production`; never rely on whatever value happens to be there. Order: **migrate first, then merge**, so the code that deploys on merge never runs against an un-migrated schema. Keep migrations backwards-compatible with the code currently deployed (expand, then contract in a later release).
