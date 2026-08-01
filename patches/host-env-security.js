/**
 * host-env-security.js — Unblock LD_ prefixes for Termux.
 *
 * Problem: OpenClaw blocks env vars starting with "LD_" to prevent library injection.
 * On Android/Termux, LD_PRELOAD and LD_LIBRARY_PATH are legitimate and often required
 * for proot-distro and other compatibility layers.
 * Fix: Remove "LD_" from the blockedPrefixes list.
 */

import path from "node:path";
import fs from "node:fs";

export const name = "host-env-security";
export const description = "Remove LD_ from blockedPrefixes so Android linker hacks survive";

export function find(distDir) {
  const files = fs
    .readdirSync(distDir)
    .filter((f) => f.startsWith("host-env-security-") && f.endsWith(".js"))
    .map((f) => path.join(distDir, f));

  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    if (content.includes("blockedPrefixes") || content.includes('"LD_"')) return f;
  }
  return null;
}

export function apply(content, filePath) {
  if (!content.includes('"LD_"')) {
    // Already removed or upstream changed the pattern
    return { patched: false };
  }

  const newContent = content.replace(/\s*["']LD_["'],?\n?/g, "");

  // Verify we didn't break the structure
  if (!newContent.includes("blockedPrefixes")) {
    return { patched: false, error: "blockedPrefixes structure missing after removal — upstream changed" };
  }

  return { patched: true, content: newContent };
}
