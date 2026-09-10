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

## Database (one database, every environment)

- `DATABASE_URL` is a **single Vercel variable scoped to Production, Preview and Development**. Previews, production and local development all read the same Neon database. There is no staging copy.
- A migration is therefore a **production change the moment it is applied**, whatever branch you are on. And a preview can only be tested against a schema production already has: a PR that adds a column has two states, both bad — apply the migration and production's schema runs ahead of its code, or don't and the preview 500s on the column that isn't there.
- So keep migrations additive and backwards-compatible (expand now, contract in a later release), and apply them deliberately, just before the merge that ships the code needing them.
- **CI never touches this database.** The `migrations` job runs against a throwaway Postgres service container: it proves every migration still applies to an empty database and that `schema.prisma` matches what they produce. It cannot prove they have been applied to the real one — nothing automated can, while previews and production share it.
- Giving previews their own database (Neon branching) is what removes the trap. Until then, treat every schema change as a production release.
