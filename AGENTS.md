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

## Database (one database, previews included)

- `DATABASE_URL` is a **single Vercel variable scoped to Production, Preview and Development** — one value, so previews and production read the same Neon database and there is no staging copy. Local development is configured separately (`packages/db/.env.example` ships a Docker URL active and the Neon block commented out), but it becomes production the moment anyone runs `vercel env pull`, `--environment=development` included.
- A migration is therefore a **production change the moment it is applied**, whatever branch you are on — and a preview can only be tested against a schema production already has, so a schema-changing PR has to apply its migration before its preview means anything.
- That is fine when the migration is **additive and backwards-compatible** (a nullable column, a new table, a new index): production's schema runs ahead of its code for a while and nothing breaks. It is not fine otherwise — dropping or renaming a column, or tightening a constraint, breaks the deployed code the instant it lands, so expand now and contract in a later release. Skipping the migration isn't an escape either: the preview then 500s on a column Prisma selects but the database doesn't have, which is what already happened once.
- Apply deliberately, just before the merge that ships the code needing it. Before any command that writes, check `echo $DATABASE_URL` **and then** `packages/db/.env` — an exported value wins over the file (dotenv is called without `override`), so reading the file alone can show `localhost` while Prisma is talking to production.
- **CI never touches this database.** The `migrations` job runs against a throwaway Postgres service container: it proves every migration still applies to an empty database and that `schema.prisma` matches what they produce. It cannot prove they have been applied to the real one — nothing automated can, while previews and production share it.
- Giving previews their own database (Neon branching) is what removes the trap. Until then, treat every schema change as a production release.
