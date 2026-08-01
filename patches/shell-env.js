/**
 * shell-env.js — Patch DEFAULT_SHELL for Termux.
 *
 * Problem: OpenClaw hardcodes DEFAULT_SHELL = "/bin/sh" which doesn't exist on Android.
 * Fix: Override to "$PREFIX/bin/bash" (Termux bash).
 */

import path from "node:path";
import fs from "node:fs";

export const name = "shell-env";
export const description = "Override DEFAULT_SHELL to Termux bash";

export function find(distDir) {
  const files = fs
    .readdirSync(distDir)
    .filter((f) => f.startsWith("shell-env-") && f.endsWith(".js"))
    .map((f) => path.join(distDir, f));

  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    if (content.includes("DEFAULT_SHELL")) return f;
  }
  return null;
}

export function apply(content, filePath) {
  const TERMUX_PREFIX = process.env.PREFIX || "/data/data/com.termux/files/usr";
  const targetShell = `${TERMUX_PREFIX}/bin/bash`;

  if (content.includes(`DEFAULT_SHELL = "${targetShell}"`)) {
    return { patched: false };
  }

  if (!content.includes('DEFAULT_SHELL = "/bin/sh"')) {
    return { patched: false, error: "DEFAULT_SHELL anchor missing — upstream changed" };
  }

  const newContent = content.replace(
    'DEFAULT_SHELL = "/bin/sh"',
    `DEFAULT_SHELL = "${targetShell}"`
  );

  return { patched: true, content: newContent };
}
