#!/usr/bin/env node
// Cross-platform replacement for the old `sh -c '...'` preinstall script.
// 1. Refuses to run under npm/yarn — this workspace must be installed with pnpm.
// 2. Removes stray lockfiles from other package managers if present.
//
// Works identically on Windows, macOS and Linux (pure Node.js, no shell).

import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error(
    `\nUse pnpm instead (detected user agent: "${userAgent || "unknown"}").\n` +
      "Install it with: npm install -g pnpm\n" +
      "Then run: pnpm install\n",
  );
  process.exit(1);
}

for (const staleLockfile of ["package-lock.json", "yarn.lock"]) {
  const fullPath = path.join(rootDir, staleLockfile);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { force: true });
    console.log(`Removed stray ${staleLockfile} (this workspace uses pnpm).`);
  }
}
