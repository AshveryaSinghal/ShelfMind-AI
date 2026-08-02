#!/usr/bin/env node
// Cross-platform replacement for the old bash-only post-merge.sh.
// Run after pulling/merging changes to keep dependencies and the database
// schema in sync. Works on Windows, macOS and Linux.
//
// Usage: node ./scripts/post-merge.mjs
// (or wire it up to your git hooks manager of choice, e.g. husky / simple-git-hooks)

import { spawnSync } from "node:child_process";

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["install", "--frozen-lockfile"]);
run("pnpm", ["--filter", "db", "push"]);
