#!/usr/bin/env node
/**
 * version-check.js — Compare installed openclaw version to a known-good list.
 *
 * Usage:
 *   node version-check.js [installedVersion]
 *
 * Reads ~/.openclaw/openclaw.json for the installed version if not provided.
 * Returns exit code 0 if version is known-good, 1 if unknown/problematic.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const KNOWN_GOOD = [
  "2026.6.10",
  "2026.6.11",
  "2026.7.0",
  "2026.7.1",
  "2026.7.2",
];

function getInstalledVersion() {
  const configPath = process.env.HOME
    ? path.join(process.env.HOME, ".openclaw", "openclaw.json")
    : "/data/data/com.termux/files/home/.openclaw/openclaw.json";

  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return cfg.version || null;
  } catch {
    return null;
  }
}

function main() {
  const version = process.argv[2] || getInstalledVersion();

  if (!version) {
    console.error("[version-check] Could not determine installed openclaw version");
    process.exit(1);
  }

  if (KNOWN_GOOD.includes(version)) {
    console.log(`[version-check] ✓ ${version} is known-good`);
    process.exit(0);
  } else {
    console.warn(`[version-check] ⚠ ${version} is NOT in the known-good list`);
    console.warn(`[version-check] Known-good versions: ${KNOWN_GOOD.join(", ")}`);
    console.warn(`[version-check] Patches may not apply cleanly; run 'tclaw patch' and check output.`);
    process.exit(1);
  }
}

main();
