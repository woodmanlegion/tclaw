#!/usr/bin/env node
/**
 * patch-engine.js — Apply patch modules to OpenClaw dist files.
 *
 * Usage:
 *   node patch-engine.js <distDir> <patchesDir>
 *
 * Each module in patchesDir is a .js file that exports:
 *   - name: string (patch name, e.g. "gateway-service")
 *   - description: string
 *   - find: (distDir) => string | null  (returns path to file to patch, or null if not applicable)
 *   - apply: (content: string, filePath: string) => { patched: boolean, content?: string, error?: string }
 *
 * The engine loads each module, runs find(), reads the file, runs apply(),
 * and writes back only if patched is true. It exits with code 0 on success
 * or 1 on failure.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distDir = process.argv[2];
const patchesDir = process.argv[3];

if (!distDir || !patchesDir) {
  console.error("Usage: node patch-engine.js <distDir> <patchesDir>");
  process.exit(1);
}

function globDist(pattern, anchor = "") {
  const files = fs
    .readdirSync(distDir)
    .filter((f) => new RegExp("^" + pattern.replace(/\*/g, ".*") + "$").test(f))
    .map((f) => path.join(distDir, f));

  if (anchor) {
    for (const f of files) {
      const content = fs.readFileSync(f, "utf8");
      if (content.includes(anchor)) return f;
    }
  }
  return files[0] || null;
}

function findDistFile(pattern, anchor) {
  let file = null;
  if (anchor) {
    const candidates = fs
      .readdirSync(distDir)
      .filter((f) => new RegExp("^" + pattern.replace(/\*/g, ".*") + "$").test(f))
      .map((f) => path.join(distDir, f));
    for (const c of candidates) {
      try {
        const content = fs.readFileSync(c, "utf8");
        if (content.includes(anchor)) {
          file = c;
          break;
        }
      } catch {}
    }
  }
  if (!file) {
    const candidates = fs
      .readdirSync(distDir)
      .filter((f) => new RegExp("^" + pattern.replace(/\*/g, ".*") + "$").test(f))
      .map((f) => path.join(distDir, f));
    if (candidates.length > 0) file = candidates[0];
  }
  return file;
}

async function run() {
  const modules = fs
    .readdirSync(patchesDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.resolve(patchesDir, f));

  if (modules.length === 0) {
    console.error("[patch-engine] No patch modules found in " + patchesDir);
    process.exit(1);
  }

  let allOk = true;

  for (const modPath of modules) {
    const mod = await import("file://" + modPath);
    const patch = mod.default || mod;
    const name = patch.name || path.basename(modPath, ".js");

    console.log(`[patch-engine] ${name}: ${patch.description || "no description"}`);

    if (typeof patch.find !== "function") {
      console.error(`  ERROR: ${name} has no find() function`);
      allOk = false;
      continue;
    }

    if (typeof patch.apply !== "function") {
      console.error(`  ERROR: ${name} has no apply() function`);
      allOk = false;
      continue;
    }

    const filePath = patch.find(distDir);
    if (!filePath) {
      console.error(`  ERROR: ${name}: find() returned null — target file not found`);
      allOk = false;
      continue;
    }

    // Patches that target files outside distDir (e.g. node_modules) may use
    // a sentinel path and write files themselves. In that case, apply()
    // returns { patched: true, content: "__already_written__" } and we skip
    // the normal read/write cycle.
    if (filePath === "__multi__") {
      const result = patch.apply("", filePath);
      if (result.patched) {
        console.log(`  ✓ patched (multi-file)`);
      } else if (result.error) {
        console.error(`  ✗ failed: ${result.error}`);
        allOk = false;
      } else {
        console.log(`  = already patched or no-op`);
      }
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const result = patch.apply(content, filePath);

    if (result.patched) {
      fs.writeFileSync(filePath, result.content || content);
      console.log(`  ✓ patched: ${filePath}`);
    } else if (result.error) {
      console.error(`  ✗ failed: ${result.error}`);
      allOk = false;
    } else {
      console.log(`  = already patched or no-op`);
    }
  }

  if (!allOk) {
    console.error("[patch-engine] One or more patches failed");
    process.exit(1);
  }

  console.log("[patch-engine] All patches applied successfully");
}

run().catch((err) => {
  console.error("[patch-engine] Unhandled error:", err);
  process.exit(1);
});
