/**
 * playwright-android.js — Patch Playwright-core to treat android as linux.
 *
 * Problem: Playwright-core checks process.platform and throws
 *   "Unsupported platform: android" on import, which crashes the browser
 *   tool's extension profile (and any code path that imports playwright-core).
 *
 * Fix: Replace `process.platform === "linux"` with
 *   `(process.platform === "linux" || process.platform === "android")`
 *   in all Playwright-core files that have platform checks.
 *
 * Android is Linux under the hood — the cache directory resolution and
 * registry logic work fine with the linux path.
 */

import fs from "node:fs";
import path from "node:path";

export const name = "playwright-android";
export const description = "Patch Playwright-core to treat android as linux for platform checks";

// Target files relative to the OpenClaw package root (parent of dist/)
const TARGET_FILES = [
  "node_modules/playwright-core/lib/tools/cli-client/registry.js",
  "node_modules/playwright-core/lib/coreBundle.js",
  "node_modules/playwright-core/lib/serverRegistry.js",
];

// The pattern we're replacing
const LINUX_CHECK = /process\.platform === "linux"(?!\s*\|\|\s*process\.platform === "android")/g;
const REPLACEMENT = '(process.platform === "linux" || process.platform === "android")';

export function find(distDir) {
  // distDir is $OPENCLAW_PKG/dist — package root is its parent
  const pkgRoot = path.dirname(distDir);
  for (const rel of TARGET_FILES) {
    const full = path.join(pkgRoot, rel);
    if (fs.existsSync(full)) return full;
  }
  // If none exist, return a sentinel — apply() will report no-op
  return "__multi__";
}

export function apply(content, filePath) {
  // When find() returns __multi__, we handle multiple files ourselves
  if (filePath === "__multi__") {
    return applyMulti();
  }

  // Single-file mode (not used, but supported)
  if (!content.match(LINUX_CHECK)) {
    return { patched: false };
  }
  return { patched: true, content: content.replace(LINUX_CHECK, REPLACEMENT) };
}

function applyMulti() {
  const distDir = process.argv[2];
  const pkgRoot = path.dirname(distDir);
  let totalPatched = 0;
  const results = [];

  for (const rel of TARGET_FILES) {
    const full = path.join(pkgRoot, rel);
    if (!fs.existsSync(full)) {
      results.push(`  = skip: ${rel} (not found)`);
      continue;
    }

    const fileContent = fs.readFileSync(full, "utf8");
    const matches = fileContent.match(LINUX_CHECK);
    if (!matches) {
      // Check if already patched
      if (fileContent.includes('process.platform === "android"')) {
        results.push(`  = already patched: ${rel}`);
      } else {
        results.push(`  = no match: ${rel}`);
      }
      continue;
    }

    const newContent = fileContent.replace(LINUX_CHECK, REPLACEMENT);
    fs.writeFileSync(full, newContent);
    results.push(`  ✓ patched: ${rel} (${matches.length} replacement(s))`);
    totalPatched++;
  }

  // Log results
  for (const r of results) console.log(r);

  if (totalPatched === 0) {
    return { patched: false };
  }

  // Return a special marker — we already wrote the files ourselves
  return { patched: true, content: "__already_written__" };
}