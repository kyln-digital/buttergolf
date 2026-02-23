import path from "node:path";
import { defineConfig } from "prisma/config";

// Load .env from this directory (prisma.config.ts skips automatic env loading)
import { config } from "dotenv";
config({ path: path.join(__dirname, ".env") });

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
});
