/**
 * oom-score.js — Patch OOM_SCORE_WRAP_SHELL for Termux.
 *
 * Problem: OpenClaw hardcodes OOM_SCORE_WRAP_SHELL = "/bin/sh" which doesn't exist on Android.
 * Fix: Override to "$PREFIX/bin/bash" (Termux bash).
 */

import path from "node:path";
import fs from "node:fs";

export const name = "oom-score";
export const description = "Override OOM_SCORE_WRAP_SHELL to Termux bash";

export function find(distDir) {
  const files = fs
    .readdirSync(distDir)
    .filter((f) => f.startsWith("linux-oom-score-") && f.endsWith(".js"))
    .map((f) => path.join(distDir, f));

  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    if (content.includes("OOM_SCORE_WRAP_SHELL")) return f;
  }
  return null;
}

export function apply(content, filePath) {
  const TERMUX_PREFIX = process.env.PREFIX || "/data/data/com.termux/files/usr";
  const targetShell = `${TERMUX_PREFIX}/bin/bash`;

  if (content.includes(`OOM_SCORE_WRAP_SHELL = "${targetShell}"`)) {
    return { patched: false };
  }

  if (!content.includes('OOM_SCORE_WRAP_SHELL = "/bin/sh"')) {
    return { patched: false, error: "OOM_SCORE_WRAP_SHELL anchor missing — upstream changed" };
  }

  const newContent = content.replace(
    'OOM_SCORE_WRAP_SHELL = "/bin/sh"',
    `OOM_SCORE_WRAP_SHELL = "${targetShell}"`
  );

  return { patched: true, content: newContent };
}
