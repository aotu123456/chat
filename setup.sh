#!/usr/bin/env bash
# multiCHAT 一键环境配置(Linux/macOS 均可使用,可重复执行)
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -t 1 ]; then
    GREEN=$(tput setaf 2 2>/dev/null || true)
    YELLOW=$(tput setaf 3 2>/dev/null || true)
    RED=$(tput setaf 1 2>/dev/null || true)
    RESET=$(tput sgr0 2>/dev/null || true)
fi

info()  { printf '%s\n' "${GREEN:-}[setup]${RESET:-} $*"; }
warn()  { printf '%s\n' "${YELLOW:-}[setup]${RESET:-} $*"; }
error() { printf '%s\n' "${RED:-}[setup]${RESET:-} $*"; }

MIN_PY_MAJOR=3
MIN_PY_MINOR=9

# ===================== 1. 检测 Python =====================
PY_BIN=""
PY_VER=""
for cand in python3 python; do
    if command -v "$cand" >/dev/null 2>&1; then
        ver=$("$cand" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)
        if [ -n "$ver" ]; then
            PY_BIN="$cand"
            PY_VER="$ver"
            break
        fi
    fi
done

if [ -z "$PY_BIN" ]; then
    error "未找到 Python。请先安装 Python $MIN_PY_MAJOR.$MIN_PY_MINOR 及以上版本。"
    exit 1
fi

maj=${PY_VER%%.*}
min=${PY_VER#*.}
min=${min%%.*}

if [ "$maj" -lt "$MIN_PY_MAJOR" ] ||
   { [ "$maj" -eq "$MIN_PY_MAJOR" ] && [ "$min" -lt "$MIN_PY_MINOR" ]; }; then
    error "检测到 Python $PY_VER,需 >= $MIN_PY_MAJOR.$MIN_PY_MINOR,请升级 Python 后重试。"
    exit 1
fi
info "检测到 Python $PY_VER ($PY_BIN)"

# ===================== 2. 创建虚拟环境 =====================
VENV_DIR="$PWD/.venv"
PY="$VENV_DIR/bin/python"

if [ ! -x "$PY" ]; then
    info "创建虚拟环境 .venv ..."
    if ! "$PY_BIN" -m venv "$VENV_DIR"; then
        error "创建虚拟环境失败。Debian/Ubuntu 请先执行: sudo apt install python3-venv"
        exit 1
    fi
else
    info ".venv 已存在,跳过创建"
fi

# ===================== 3. 安装依赖 =====================
info "升级 pip ..."
"$PY" -m pip install --upgrade pip
info "安装依赖(backend/requirements.txt) ..."
"$PY" -m pip install -r backend/requirements.txt

# ===================== 4. 生成 .env =====================
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env"
        info "已生成 .env(模板自 .env.example)"
        warn "请编辑 .env,填入真实 DEEPSEEK_API_KEY(图像功能可选填 DASHSCOPE_API_KEY),然后执行 ./start.sh"
    else
        warn "缺少 .env.example,无法自动生成 .env"
    fi
else
    warn ".env 已存在,未覆盖(如需重建可删除后重新运行 setup.sh)"
fi

info "环境配置完成 ✓"
info "首次启动前: 编辑 .env → 然后运行  chmod +x start.sh && ./start.sh"
