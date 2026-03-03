import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const files = ["packages/db/.env", "apps/web/.env.local", ".env", ".env.local"];

for (const relative of files) {
  const filePath = path.resolve(process.cwd(), relative);
  if (!fs.existsSync(filePath)) continue;

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  const raw = parsed.DATABASE_URL;

  if (!raw) {
    console.log(`${relative}: DATABASE_URL not set`);
    continue;
  }

  try {
    const url = new URL(raw);
    const dbName = url.pathname.replace(/^\//, "") || "(none)";
    const port = url.port || "(default)";
    console.log(`${relative}: ${url.protocol}//${url.hostname}:${port}/${dbName}`);
  } catch {
    console.log(`${relative}: DATABASE_URL present (unparseable)`);
  }
}
