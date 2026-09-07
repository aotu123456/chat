#!/usr/bin/env bash
# multiCHAT 启动脚本: 在 backend 目录以 .venv 启动 FastAPI,并打开浏览器
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PY="$PWD/.venv/bin/python"
RUN="backend/run.py"

if [ ! -x "$PY" ]; then
    printf '%s\n' "[start] 未找到 .venv,请先运行 ./setup.sh"
    exit 1
fi

if [ ! -f "$RUN" ]; then
    printf '%s\n' "[start] 缺少 $RUN"
    exit 1
fi

URL="http://127.0.0.1:8000"

if command -v xdg-open >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
    (xdg-open "$URL" >/dev/null 2>&1 &) || true
elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
fi

printf '%s\n' "[start] 浏览器访问: $URL (Ctrl+C 停止)"
cd backend
exec "$PY" run.py
