# YXWatermark

面向个人与小团队的图片水印 Web 工具。添加水印在浏览器本地完成；去水印通过内置 AI（LaMa）服务处理。

## 一键 Docker 部署（推荐）

需要安装 [Docker Desktop](https://www.docker.com/)。

```bash
docker compose up -d --build
```

首次启动会拉取镜像并下载 LaMa 模型，可能需要 **3–10 分钟**。

启动完成后浏览器打开：

**http://localhost:3000**

确认右上角 **AI 在线**（绿灯）即可使用去水印功能。

### 常用命令

```bash
docker compose ps          # 查看状态
docker compose logs -f     # 查看日志
docker compose down        # 停止并移除容器
docker compose up -d --build  # 代码更新后重新构建
```

## 功能

- **添加水印**：文字、Logo、九宫格定位、平铺、PNG/JPEG 导出（纯浏览器本地，不上传）
- **去除水印**：
  - **手动标记**（推荐）：矩形框选文字水印 + AI 修复
  - 自动识别（实验性）
  - 简单修复（OpenCV.js，无 AI 时可用，效果有限）

## 架构

```
浏览器  →  http://localhost:3000  (Nginx 前端)
              ↓ /lama-api/*
           ai:8080  (LaMa 去水印，Docker 内网)
```

- 前端与 AI 通过 Nginx 反向代理同域访问，无需分开启动
- AI 服务地址默认 `/lama-api`，一般无需修改

## 本地开发（可选）

如需修改代码并热更新：

```bash
npm install
npm run dev          # 前端 http://localhost:5173
docker compose up -d ai   # 仅启动 AI 服务（或使用完整 compose）
```

## 使用说明

### 添加水印

1. 上传图片 → 配置文字 / Logo / 平铺 → 下载

### 去除文字水印

1. 确认 **AI 在线**
2. 选择「手动标记」→ 矩形工具 **紧贴文字** 框选
3. 点击「开始修复」→ 对比预览 → 下载

## 隐私

- **添加水印**：图片在浏览器内处理，不上传
- **去水印（AI）**：图片经 Nginx 转发至本机 Docker 内的 AI 服务，不出公网
- **简单修复**：完全在浏览器内完成

## 技术栈

- React 18 + Vite + TypeScript + Konva + Tailwind
- Nginx + Docker Compose
- lama-cleaner 1.2.5 + LaMa

## 许可证

MIT
