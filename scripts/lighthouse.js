#!/usr/bin/env node

/**
 * Local Lighthouse performance testing script
 *
 * Usage: pnpm lighthouse
 *
 * Runs Lighthouse audits on specified URLs using the configuration
 * defined in lighthouserc.js. Reports pass/fail based on thresholds.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

console.log("ButterGolf Lighthouse Audit\n");
console.log("Starting web server and running Lighthouse audits...\n");

// Run Lighthouse CI
const lhci = spawn("lhci", ["autorun"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
});

lhci.on("close", (code) => {
  if (code === 0) {
    console.log("\nLighthouse audit passed!\n");
    process.exit(0);
  } else {
    console.log("\nLighthouse audit failed. Check the results above.\n");
    process.exit(1);
  }
});

lhci.on("error", (error) => {
  console.error("Failed to start Lighthouse:", error);
  process.exit(1);
});
