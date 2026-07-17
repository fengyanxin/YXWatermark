# YXWatermark

面向个人与小团队的图片 / 视频水印 Web 工具。添加水印在浏览器本地完成；去水印通过内置 AI（LaMa）服务处理。

## 一键 Docker 部署（推荐）

需要安装 [Docker Desktop](https://www.docker.com/)。

```bash
docker compose up -d --build
```

首次启动会拉取镜像并下载 LaMa 模型，可能需要 **3–10 分钟**。

启动完成后浏览器打开：

**http://localhost:3000**

确认右上角 **AI 在线**（绿灯）即可使用图片/视频去水印功能。

> 视频导出依赖 WebCodecs / MediaRecorder，建议使用 **Chrome / Edge 最新版**。

### 常用命令

```bash
docker compose ps              # 查看状态
docker compose logs -f         # 查看日志
docker compose down            # 停止并移除容器
docker compose up -d --build   # 代码更新后重新构建
```

## 功能

### 图片

- **添加水印**：文字、Logo、九宫格定位、平铺、PNG/JPEG 导出（纯浏览器本地，不上传）
- **去除水印**：
  - **手动标记**（推荐）：画笔 / 矩形框选 + 撤销（Ctrl+Z）
  - 自动识别（实验性）
  - 简单修复（OpenCV.js，无 AI 时可用，效果有限）

### 视频

- **添加水印**：
  - 与图片相同的水印配置，预览区可播放预览
  - 保留原分辨率、帧率、时长；WebM 可保留音轨
  - 导出格式：**WebM**（推荐）或 **MP4**（视浏览器而定）
- **去除水印**：
  - 在参考帧上标记固定位置水印，逐帧 AI 修复
  - 导出 **MP4**（优先 WebCodecs，不支持时自动回退）
  - 帧率不低于原片（上传时自动探测）；帧数 = 时长 × fps
  - 最长 **60 秒**；导出不含音轨

## 架构

```
浏览器  →  http://localhost:3000  (Nginx 静态服务 + AI 代理)
              ↓ /lama-api/*
           ai:8080  (LaMa 去水印，Docker 内网)
```

- 图片/视频**添加水印**：100% 浏览器本地，不经服务器
- 图片/视频**去水印（AI）**：帧数据经 web 容器转发至 ai 服务，不出公网
- AI 服务地址默认 `/lama-api`，一般无需修改
- 视频逐帧修复会多次调用 AI，Docker 默认单帧代理超时 10 分钟

## 本地开发（可选）

```bash
npm install
npm run dev                    # 前端 http://localhost:5173
docker compose up -d ai        # 仅启动 AI 服务
```

完整功能（含 AI 代理）可继续用 `docker compose up -d --build` 访问 3000 端口。

## 使用说明

### 添加水印（图片 / 视频）

1. 顶部切换「图片」或「视频」
2. 上传文件 → 右侧配置文字 / Logo / 平铺
3. 视频可在中间预览区播放查看动态效果
4. 视频导出可选 **WebM / MP4**，点击「保存视频」或「下载」

### 去除文字水印（图片 / 视频）

**图片：**

1. 确认 **AI 在线**
2. 选择「手动标记」→ 画笔或矩形 **紧贴文字** 框选
3. 点击「开始修复」→ 对比预览 → 下载

**视频：**

1. 上传视频，拖动时间轴选择有水印的参考帧
2. 画笔 / 矩形框选水印区域（支持撤销）
3. 点击「开始修复并导出」
4. 流程：逐帧提取 → AI 修复 → 编码 MP4；可在「视频效果对比」预览结果

> 视频去水印耗时与帧数成正比（如 16s × 30fps ≈ 480 帧），请耐心等待。

## 导出说明

| 场景 | 格式 | 分辨率 / 帧率 / 时长 | 音轨 |
|------|------|----------------------|------|
| 图片加水印 | PNG / JPEG | 与原图一致 | — |
| 视频加水印 | WebM（推荐）/ MP4 | 与原片一致 | WebM 通常保留 |
| 视频去水印 | MP4 | 与原片一致 | 不含 |

加水印会经 Canvas 重编码，码率已按分辨率分级提高，但仍可能略低于极高码率原片，属正常现象。

## 隐私

- **添加水印（图片/视频）**：在浏览器内处理，不上传
- **去水印（AI）**：图片/视频帧经 web 容器转发至本机 Docker 内的 AI 服务，不出公网
- **简单修复**：完全在浏览器内完成

## 技术栈

- React 19 + Vite + TypeScript + Konva + Tailwind + Zustand
- WebCodecs + mp4-muxer（视频 MP4 导出）
- MediaRecorder + Canvas（视频 WebM / 加水印）
- Docker Compose + Nginx + Node AI 代理
- lama-cleaner 1.2.5 + LaMa

## 许可证

MIT
