# tclaw — Termux OpenClaw Installer & Patcher

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**tclaw** is the official Termux installer, patcher, and maintenance toolkit for [OpenClaw](https://github.com/openclaw/openclaw) on Android/Termux.

## What It Does

OpenClaw is designed primarily for desktop platforms (macOS, Linux, Windows). Running it on Android via Termux requires a few compatibility patches:

| Patch | Problem | Fix |
|---|---|---|
| **Gateway Service Registry** | `process.platform === "android"` hard-throws | Adds runit-based service management for Termux |
| **Shell Environment** | `DEFAULT_SHELL` hardcodes `/bin/sh` | Points to Termux bash (`$PREFIX/bin/bash`) |
| **OOM Score** | `OOM_SCORE_WRAP_SHELL` hardcodes `/bin/sh` | Points to Termux bash |
| **Host Env Security** | Blocks `LD_PRELOAD` and other `LD_` vars | Removes `LD_` from blocked prefixes so Android linker hacks survive |

## Quick Start

```bash
# One-liner install (not yet available — WIP)
# curl -fsSL https://raw.githubusercontent.com/woodmanlegion/tclaw/main/install.sh | bash

# Manual clone + run
pkg install git
gh repo clone woodmanlegion/tclaw
./tclaw install
```

## Usage

```bash
./tclaw install       # Full install/setup cycle
./tclaw patch         # Apply all OpenClaw Termux patches
./tclaw update        # npm update + patch + restart
./tclaw status        # Show service, gateway, and patch status
./tclaw start         # sv up openclaw
./tclaw stop          # sv down openclaw
./tclaw restart       # sv restart openclaw
./tclaw logs          # Tail the gateway log file
./tclaw doctor        # Run openclaw doctor
./tclaw env           # Show .env keys (values hidden)
./tclaw sms-on        # Enable SMS channel plugin
./tclaw sms-off       # Disable SMS channel plugin
./tclaw sms-status    # Show SMS channel enabled state
./tclaw help          # Show this help
```

## Architecture

- `tclaw` — main bash entrypoint (commands, dispatch, status)
- `lib/patch-engine.js` — finds dist files by glob+anchor, applies patch functions, verifies anchors
- `lib/version-check.js` — compares installed openclaw version to a known-good list
- `patches/` — individual patch modules:
  - `gateway-service.js` — Android runit service adapter
  - `shell-env.js` — DEFAULT_SHELL override
  - `oom-score.js` — OOM_SCORE_WRAP_SHELL override
  - `host-env-security.js` — unblock LD_ prefixes

## Requirements

- Android device with Termux
- `node`, `npm`, `git`, `jq` (installed automatically)
- `termux-services` (runit) for service management
- Root access **not required** for basic operation (needed for some MMS/SMS features)

## License

MIT — see [LICENSE](LICENSE).
