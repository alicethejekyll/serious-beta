#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  task_node_dir="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  if [ ! -x "$task_node_dir/node" ]; then
    echo '请先安装 Node.js 22+ 和 pnpm 11.19.0。' >&2
    exit 1
  fi
  PATH="$task_node_dir:$PATH"
  export PATH
fi
if ! command -v pnpm >/dev/null 2>&1; then
  task_pnpm_dir="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"
  if [ ! -x "$task_pnpm_dir/pnpm" ]; then
    echo '请先安装 pnpm 11.19.0。' >&2
    exit 1
  fi
  PATH="$task_pnpm_dir:$PATH"
  export PATH
fi
if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile
fi
exec pnpm dev
