#!/usr/bin/env node
/**
 * Static GitHub Pages build:
 * - Moves App Router API routes aside (static export cannot include them)
 * - Builds with GITHUB_PAGES=true (output: 'export' + basePath)
 * - Restores API routes afterward
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "src", "app", "api");
const apiBackup = path.join(root, "src", "app", "_api_pages_backup");
const outDir = path.join(root, "out");

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

let moved = false;
try {
  if (fs.existsSync(apiBackup)) {
    fs.rmSync(apiBackup, { recursive: true, force: true });
  }
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, apiBackup);
    moved = true;
    console.log("Temporarily moved src/app/api for static export");
  }

  run("npx", ["next", "build"], { GITHUB_PAGES: "true" });

  // GitHub Pages should not run Jekyll over the export
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
  console.log("Wrote out/.nojekyll");
} finally {
  if (moved && fs.existsSync(apiBackup)) {
    if (fs.existsSync(apiDir)) {
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    fs.renameSync(apiBackup, apiDir);
    console.log("Restored src/app/api");
  }
}
