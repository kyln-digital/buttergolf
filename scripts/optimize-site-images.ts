#!/usr/bin/env tsx

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

type RasterExtension = "jpg" | "jpeg" | "png" | "webp" | "avif";

interface OptimizerConfig {
  quality: number;
  webpQuality: number;
  avifQuality: number;
  maxWidth: number;
  dryRun: boolean;
  includeAvif: boolean;
}

interface FileResult {
  file: string;
  beforeBytes: number;
  afterBytes: number;
  derivativeBytes: number;
  skipped?: string;
}

const SUPPORTED_RASTER_EXTENSIONS = new Set<RasterExtension>([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
]);
const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".expo", "dist", "generated", ".git"]);
const DEFAULT_TARGETS = [
  "apps/web/public/_assets/images",
  "apps/web/public/backgrounds",
  "packages/assets/images",
];

function parseArgs(argv: string[]): { config: OptimizerConfig; targets: string[] } {
  const config: OptimizerConfig = {
    quality: 78,
    webpQuality: 76,
    avifQuality: 62,
    maxWidth: 2400,
    dryRun: argv.includes("--dry-run"),
    includeAvif: !argv.includes("--no-avif"),
  };

  const targets: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--quality=")) {
      config.quality = Number(arg.split("=")[1] ?? config.quality);
      continue;
    }

    if (arg.startsWith("--webp-quality=")) {
      config.webpQuality = Number(arg.split("=")[1] ?? config.webpQuality);
      continue;
    }

    if (arg.startsWith("--avif-quality=")) {
      config.avifQuality = Number(arg.split("=")[1] ?? config.avifQuality);
      continue;
    }

    if (arg.startsWith("--max-width=")) {
      config.maxWidth = Number(arg.split("=")[1] ?? config.maxWidth);
      continue;
    }

    if (!arg.startsWith("--")) {
      targets.push(arg);
    }
  }

  return {
    config,
    targets: targets.length > 0 ? targets : DEFAULT_TARGETS,
  };
}

function bytesToKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function getExt(filePath: string): string {
  return path.extname(filePath).replace(".", "").toLowerCase();
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...(await walkFiles(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

async function ensureDirectoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function optimizeImage(filePath: string, config: OptimizerConfig): Promise<FileResult> {
  const relative = path.relative(process.cwd(), filePath);
  const extension = getExt(filePath) as RasterExtension;
  const originalBuffer = await fs.readFile(filePath);
  const beforeBytes = originalBuffer.length;

  if (!SUPPORTED_RASTER_EXTENSIONS.has(extension)) {
    return {
      file: relative,
      beforeBytes,
      afterBytes: beforeBytes,
      derivativeBytes: 0,
      skipped: "unsupported extension",
    };
  }

  const image = sharp(originalBuffer, { failOn: "none" }).rotate();
  let metadata: sharp.Metadata;

  try {
    metadata = await image.metadata();
  } catch {
    return {
      file: relative,
      beforeBytes,
      afterBytes: beforeBytes,
      derivativeBytes: 0,
      skipped: "unsupported image contents",
    };
  }

  if (!metadata.width || !metadata.height) {
    return {
      file: relative,
      beforeBytes,
      afterBytes: beforeBytes,
      derivativeBytes: 0,
      skipped: "missing dimensions",
    };
  }

  const shouldResize = metadata.width > config.maxWidth;

  let pipeline = image;
  if (shouldResize) {
    pipeline = pipeline.resize({ width: config.maxWidth, withoutEnlargement: true });
  }

  let optimized: Buffer;

  switch (extension) {
    case "jpg":
    case "jpeg":
      optimized = await pipeline.jpeg({ quality: config.quality, mozjpeg: true }).toBuffer();
      break;
    case "png":
      optimized = await pipeline
        .png({ quality: config.quality, compressionLevel: 9, palette: true })
        .toBuffer();
      break;
    case "webp":
      optimized = await pipeline.webp({ quality: config.webpQuality, effort: 5 }).toBuffer();
      break;
    case "avif":
      optimized = await pipeline.avif({ quality: config.avifQuality, effort: 6 }).toBuffer();
      break;
    default:
      optimized = originalBuffer;
  }

  const baseName = filePath.slice(0, -path.extname(filePath).length);
  const webpPath = `${baseName}.webp`;
  const avifPath = `${baseName}.avif`;

  const webpBuffer = await pipeline.webp({ quality: config.webpQuality, effort: 5 }).toBuffer();
  const avifBuffer = config.includeAvif
    ? await pipeline.avif({ quality: config.avifQuality, effort: 6 }).toBuffer()
    : null;

  if (!config.dryRun) {
    // Only overwrite original if the optimized output is smaller.
    if (optimized.length < beforeBytes) {
      await fs.writeFile(filePath, optimized);
    }

    if (webpPath !== filePath) {
      await fs.writeFile(webpPath, webpBuffer);
    }

    if (avifBuffer && avifPath !== filePath) {
      await fs.writeFile(avifPath, avifBuffer);
    }
  }

  const afterBytes = optimized.length < beforeBytes ? optimized.length : beforeBytes;

  return {
    file: relative,
    beforeBytes,
    afterBytes,
    derivativeBytes: webpBuffer.length + (avifBuffer?.length ?? 0),
  };
}

async function main(): Promise<void> {
  const { config, targets } = parseArgs(process.argv.slice(2));

  console.log("🖼️  Optimizing site images");
  console.log(`Mode: ${config.dryRun ? "dry-run" : "write"}`);
  console.log(`Targets: ${targets.join(", ")}`);
  console.log(
    `Settings: quality=${config.quality}, webp=${config.webpQuality}, avif=${config.avifQuality}, maxWidth=${config.maxWidth}`
  );

  const allFiles: string[] = [];

  for (const target of targets) {
    const absTarget = path.resolve(process.cwd(), target);
    const exists = await ensureDirectoryExists(absTarget);

    if (!exists) {
      console.log(`⚠️  Skipping missing directory: ${target}`);
      continue;
    }

    const files = await walkFiles(absTarget);
    allFiles.push(...files);
  }

  const rasterFiles = allFiles.filter((filePath) =>
    SUPPORTED_RASTER_EXTENSIONS.has(getExt(filePath) as RasterExtension)
  );

  if (rasterFiles.length === 0) {
    console.log("No raster image files found.");
    return;
  }

  const results: FileResult[] = [];
  const failures: string[] = [];

  for (const filePath of rasterFiles) {
    try {
      const result = await optimizeImage(filePath, config);
      results.push(result);
    } catch (error) {
      const relative = path.relative(process.cwd(), filePath);
      failures.push(`${relative}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const totalBefore = results.reduce((sum, item) => sum + item.beforeBytes, 0);
  const totalAfter = results.reduce((sum, item) => sum + item.afterBytes, 0);
  const totalSaved = totalBefore - totalAfter;

  console.log("\nSummary");
  console.log(`Files processed: ${results.length}`);
  console.log(`Before: ${bytesToKb(totalBefore)}`);
  console.log(`After:  ${bytesToKb(totalAfter)}`);
  console.log(
    `Saved:  ${bytesToKb(totalSaved)} (${((totalSaved / Math.max(totalBefore, 1)) * 100).toFixed(1)}%)`
  );

  const topSavings = [...results]
    .map((item) => ({ ...item, saved: item.beforeBytes - item.afterBytes }))
    .sort((a, b) => b.saved - a.saved)
    .slice(0, 10);

  if (topSavings.length > 0) {
    console.log("\nTop savings:");
    for (const item of topSavings) {
      if (item.saved <= 0) continue;
      console.log(`- ${item.file}: ${bytesToKb(item.saved)} saved`);
    }
  }

  const skippedCount = results.filter((item) => item.skipped).length;
  if (skippedCount > 0) {
    console.log(`Skipped: ${skippedCount}`);
  }

  if (failures.length > 0) {
    console.log("\nFailed files:");
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }

  if (config.dryRun) {
    console.log("\nDry run complete. Re-run without --dry-run to apply changes.");
  }
}

main().catch((error) => {
  console.error("Image optimization failed:", error);
  process.exitCode = 1;
});
