# What This Is

This directory is a snapshot clone of **woodmanlegion/tclaw** from GitHub:

- **Source:** https://github.com/woodmanlegion/tclaw
- **Author:** https://github.com/woodmanlegion

`tclaw` is the Termux OpenClaw installer, patcher, and maintenance toolkit. It is not a runtime dependency — OpenClaw is installed globally via npm at `/data/data/com.termux/files/usr/lib/node_modules/openclaw/`. This repo is kept for:

- Running `tclaw` commands (patch, update, status, etc.) — the script is symlinked into `~/.local/bin/tclaw`
- Access to the patch engine (`lib/`) and patch modules (`patches/`)

The `tclaw` executable at `~/.local/bin/tclaw` is a symlink to `./tclaw` in this directory, so `SCRIPT_DIR` resolves here at runtime.