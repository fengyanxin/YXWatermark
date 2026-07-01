#!/usr/bin/env bash
# 无需 Docker，使用 pip 在本机启动 IOPaint (LaMa)
# 用法: ./scripts/start-ai-local.sh

set -e

PORT="${IOPAINT_PORT:-8080}"
VENV_DIR="${VENV_DIR:-.venv-iopaint}"

echo "→ 创建虚拟环境: $VENV_DIR"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

echo "→ 安装 IOPaint（首次较慢，需下载 PyTorch 和 LaMa 模型）..."
pip install -q --upgrade pip
pip install -q iopaint

echo "→ 启动 AI 服务 http://localhost:$PORT"
echo "  按 Ctrl+C 停止"
iopaint start --model lama --device cpu --host 0.0.0.0 --port "$PORT"
