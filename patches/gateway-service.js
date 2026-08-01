/**
 * gateway-service.js — Patch OpenClaw's gateway service registry for Android/Termux.
 *
 * Problem: process.platform === "android" hard-throws
 *   "Gateway service install not supported on android"
 * because GATEWAY_SERVICE_REGISTRY only knows darwin/linux/win32.
 *
 * Fix: add an android entry that delegates to runit (sv).
 */

import path from "node:path";
import fs from "node:fs";

export const name = "gateway-service";
export const description = "Add Android/Termux runit service adapter to gateway registry";

export function find(distDir) {
  const files = fs
    .readdirSync(distDir)
    .filter((f) => f.startsWith("service-") && f.endsWith(".js"))
    .map((f) => path.join(distDir, f));

  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    if (content.includes("GATEWAY_SERVICE_REGISTRY")) return f;
  }
  return null;
}

export function apply(content, filePath) {
  if (content.includes("termux-services (runit)")) {
    return { patched: false };
  }

  if (!content.includes("GATEWAY_SERVICE_REGISTRY")) {
    return { patched: false, error: "anchor GATEWAY_SERVICE_REGISTRY missing — upstream changed" };
  }

  const TERMUX_ADAPTER_CODE = `
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const TERMUX_SERVICE_UNIT = "openclaw";
const TERMUX_SERVICE_DIR = path.join(process.env.PREFIX || "/data/data/com.termux/files/usr", "var", "service");
function resolveTermuxServiceRunPath() { return path.join(TERMUX_SERVICE_DIR, TERMUX_SERVICE_UNIT, "run"); }
async function svStatus() {
  try {
    const { stdout } = await execFileP("sv", ["status", TERMUX_SERVICE_UNIT], { timeout: 5000 });
    const first = stdout.split("\\n", 1)[0] || "";
    return { loaded: true, running: first.startsWith("run:"), message: first.trim() };
  } catch { return { loaded: false, running: false, message: "" }; }
}
async function isTermuxUnitInstalled() { return fs.existsSync(resolveTermuxServiceRunPath()); }
async function readTermuxCommand(env) {
  const runPath = resolveTermuxServiceRunPath();
  if (!fs.existsSync(runPath)) return null;
  try {
    const content = fs.readFileSync(runPath, "utf8");
    const lines = content.split("\\n").map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith("#") && !l.startsWith("export "));
    const execLine = lines.find(l => /^exec\s+[A-Za-z]/.test(l)) || lines.find(l => /^[A-Za-z]/.test(l)) || "openclaw";
    const programArguments = execLine.replace(/^exec\s+/, "").split(/\s+/);
    return { programArguments, environment: env, environmentValueSources: {}, sourcePath: runPath };
  } catch { return null; }
}
async function readTermuxRuntime(env) {
  const installed = await isTermuxUnitInstalled();
  if (!installed) return { status: "not-installed" };
  const { running, message } = await svStatus();
  return { status: running ? "running" : "stopped", detail: message || void 0 };
}
async function isTermuxServiceLoaded({ env }) {
  const installed = await isTermuxUnitInstalled();
  if (!installed) return false;
  const { loaded } = await svStatus();
  return loaded;
}
async function stopTermuxService({ stdout, env }) {
  try { await execFileP("sv", ["down", TERMUX_SERVICE_UNIT], { timeout: 5000 }); stdout.write(\`Stopped termux service: \${TERMUX_SERVICE_UNIT}\\n\`); } catch { /* unit may not exist */ }
}
async function restartTermuxService({ stdout, env }) {
  try {
    await execFileP("sv", ["restart", TERMUX_SERVICE_UNIT], { timeout: 5000 });
    stdout.write(\`Restarted termux service: \${TERMUX_SERVICE_UNIT}\\n\`);
    return { outcome: "completed" };
  } catch (err) { throw new Error("openclaw service is not supervised. Run: mkdir -p $PREFIX/var/service/openclaw && create a run script in $PREFIX/var/service/openclaw/run"); }
}
async function uninstallTermuxService({ env, stdout }) {
  try { await execFileP("sv", ["down", TERMUX_SERVICE_UNIT], { timeout: 5000 }); } catch {}
  stdout.write(\`Termux service disabled: \${TERMUX_SERVICE_UNIT}\\n\`);
}
const TERMUX_INSTALL_HINT = [
  "Service lifecycle on Termux is managed by runit (termux-services).",
  "Install:    pkg install termux-services",
  "Create:     mkdir -p $PREFIX/var/service/openclaw",
  "            cat > $PREFIX/var/service/openclaw/run <<'EOF'",
  "            #!/data/data/com.termux/files/usr/bin/sh",
  "            exec openclaw gateway run",
  "            EOF",
  "            chmod +x $PREFIX/var/service/openclaw/run",
  "Enable:     sv up openclaw",
  "Status:     sv status openclaw"
].join("\\n");
`;

  const anchor1 = 'import os from "node:os";\n';
  if (content.indexOf(anchor1) === -1) {
    return { patched: false, error: "anchor 1 missing — upstream changed" };
  }
  const idx1 = content.indexOf(anchor1);
  content = content.slice(0, idx1 + anchor1.length) + TERMUX_ADAPTER_CODE + content.slice(idx1 + anchor1.length);

  const win32EndMarker = "readRuntime: readScheduledTaskRuntime\n\t}\n};";
  const idx2 = content.indexOf(win32EndMarker);
  if (idx2 === -1) {
    return { patched: false, error: "cannot find win32 block end in registry" };
  }
  const replacement = `readRuntime: readScheduledTaskRuntime
\t},
\tandroid: {
\t\tlabel: "termux-services (runit)",
\t\tloadedText: "supervised",
\t\tnotLoadedText: "unsupervised",
\t\tstage: ignoreServiceWriteResult(async () => {}),
\t\tinstall: ignoreServiceWriteResult(async () => { process.stderr.write(\`[termux-shim] \${TERMUX_INSTALL_HINT}\\n\`); }),
\t\tuninstall: uninstallTermuxService,
\t\tstop: stopTermuxService,
\t\trestart: restartTermuxService,
\t\tisLoaded: isTermuxServiceLoaded,
\t\treadCommand: readTermuxCommand,
\t\treadRuntime: readTermuxRuntime
\t}
};`;
  content = content.slice(0, idx2) + replacement + content.slice(idx2 + win32EndMarker.length);

  return { patched: true, content };
}
