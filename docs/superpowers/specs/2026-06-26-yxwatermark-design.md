# YXWatermark 产品设计规格

> 版本：MVP v1  
> 日期：2026-06-26  
> 状态：待评审

## 1. 概述

YXWatermark 是一款面向个人与小团队的图片水印 Web 应用，提供**添加水印**与**去除水印**两大能力。

核心原则：

- **添加水印**：100% 浏览器本地处理，图片不上传，零成本
- **去除水印**：三级降级策略——本机 AI（最佳）→ 浏览器 OpenCV（简单场景）→ 可选云端 API（后续扩展）
- **零月费起步**：MVP 不依赖任何付费 API

## 2. 目标用户与场景

| 维度 | 说明 |
|------|------|
| 用户 | 个人创作者、小团队设计师 |
| 场景 | 给自己的照片/设计稿批量加水印；去掉自己图片上已知位置的水印 |
| 非目标 | 通用「任意图片盗删水印」服务、视频水印、企业级 SaaS |

## 3. 功能规格

### 3.1 添加水印（纯本地）

| 能力 | 详细说明 |
|------|----------|
| 文字水印 | 内容、字号、字体（系统字体集）、颜色、透明度（0–100%）、旋转角度（-180°–180°） |
| Logo 水印 | 上传 PNG/WebP（支持透明通道），可调大小 |
| 位置 | 九宫格快捷定位 + 画布拖拽微调 |
| 平铺 | 开关、水平/垂直间距、平铺角度 |
| 图层 | 文字与 Logo 可独立开关，Logo 与文字可同时存在 |
| 预览 | 实时 Canvas 预览，所见即所得 |
| 导出 | PNG（默认）、JPEG（可调质量 60–100%） |
| 批量 | MVP 不做 |

### 3.2 去除水印（混合处理）

#### 模式 A：AI 自动识别

1. 用户上传图片
2. 前端检测本机 AI 服务是否可用（`GET /health`）
3. 若可用：发送至本机 IOPaint/LaMa 服务自动检测并修复
4. 若不可用：提示用户启动本地服务，或切换至模式 B/C

#### 模式 B：手动框选 + AI 修复

1. 用户在画布上用**画笔涂抹**或**矩形框选**标记水印区域
2. 前端生成黑白 mask 图
3. 优先发送至本机 AI 服务（LaMa inpainting）
4. 支持多次微调（重新涂抹 → 再次处理）
5. 前后对比滑块预览

#### 模式 C：浏览器降级修复（OpenCV.js）

触发条件：本机 AI 服务不可用时，用户选择「简单修复（本地）」

- 使用 opencv.js 的 `inpaint`（Telea / Navier-Stokes 算法）
- 仅适合小面积、半透明文字类简单水印
- UI 明确标注「效果有限，复杂水印请启动 AI 服务」
- 100% 浏览器内完成，零安装

#### 处理优先级（降级链）

```
手动/自动去水印请求
    │
    ├─ 本机 AI 在线？ ──是──► LaMa/IOPaint 修复（最佳效果）
    │
    └─ 否 ──► 提示用户
              ├─ [启动本地 AI 服务] 引导（Docker/脚本说明）
              └─ [使用简单修复] ──► opencv.js 浏览器内修复
```

### 3.3 本机 AI 服务

| 项 | 说明 |
|----|------|
| 引擎 | IOPaint（开源）+ LaMa 模型 |
| 部署 | Docker Compose 一键启动，或 Python 脚本 |
| 端口 | 默认 `http://localhost:8080` |
| API | 复用 IOPaint 现有 REST API；前端封装统一调用层 |
| 配置 | 前端设置页可修改 AI 服务地址 |
| 隐私 | 图片仅在用户本机流转，不上传公网 |

## 4. 信息架构与页面结构

```
┌──────────────────────────────────────────────────────┐
│  YXWatermark                    [添加水印 | 去水印]   │
│                              [⚙ 设置] [AI 状态指示] │
├──────────────┬───────────────────────┬───────────────┤
│              │                       │               │
│   上传/拖拽   │     画布预览区         │   参数面板     │
│   区域       │   （Konva 实时渲染）    │               │
│              │                       │               │
├──────────────┴───────────────────────┴───────────────┤
│                    [下载图片]                         │
└──────────────────────────────────────────────────────┘
```

### Tab：添加水印

- 左：上传区（拖拽/点击，支持 JPG/PNG/WebP）
- 中：Konva 画布预览
- 右：参数面板（Tab 切换「文字」「Logo」「平铺」）

### Tab：去除水印

- 左：上传区
- 中：Konva 画布（查看/编辑模式，画笔/矩形工具）
- 右：处理选项（自动 / 手动 / 简单修复）+ 前后对比
- 顶栏：AI 服务状态灯（🟢 在线 / 🔴 离线）

### 设置面板

- AI 服务地址（默认 `http://localhost:8080`）
- 检测连接按钮
- 本地 AI 启动指南链接

## 5. 技术架构

### 5.1 前端

| 技术 | 用途 |
|------|------|
| React 18 + Vite + TypeScript | 应用框架 |
| Konva.js / react-konva | 画布渲染、水印叠加、mask 绘制 |
| Zustand | 全局状态（图片、水印配置、AI 连接状态） |
| Tailwind CSS | 样式 |
| opencv.js | 浏览器降级 inpainting |

### 5.2 本机 AI 服务（可选组件）

| 技术 | 用途 |
|------|------|
| IOPaint (Docker) | LaMa inpainting 服务 |
| docker-compose.yml | 一键启动，项目根目录提供 |

### 5.3 目录结构（预期）

```
YXWatermark/
├── docs/superpowers/specs/     # 设计文档
├── public/
├── src/
│   ├── components/             # UI 组件
│   ├── features/
│   │   ├── add-watermark/    # 加水印功能模块
│   │   └── remove-watermark/ # 去水印功能模块
│   ├── lib/
│   │   ├── canvas/           # Konva 工具
│   │   ├── opencv/           # opencv.js 封装
│   │   └── ai-service/       # 本机 AI API 客户端
│   ├── stores/               # Zustand stores
│   └── App.tsx
├── docker-compose.yml          # IOPaint 本地服务
├── package.json
└── README.md                   # 含本地 AI 启动说明
```

### 5.4 数据流

#### 添加水印

```
File → FileReader → HTMLImageElement → Konva Stage
                                              ↓
WatermarkConfig → Konva Layer (text/image) → export toDataURL → 下载
```

#### 去水印（本机 AI）

```
File → Canvas → [auto] POST /api/v1/inpaint (IOPaint)
              → [manual] 用户绘制 mask → POST with image + mask
              → 返回修复图 → 预览对比 → 下载
```

#### 去水印（opencv.js 降级）

```
File → Canvas → 用户绘制 mask → Mat → cv.inpaint → 输出 Canvas → 下载
```

## 6. AI 服务 API 封装

前端统一接口，屏蔽 IOPaint 细节：

```typescript
interface AIServiceClient {
  checkHealth(): Promise<boolean>
  removeAuto(image: Blob): Promise<Blob>
  removeManual(image: Blob, mask: Blob): Promise<Blob>
}
```

- 连接失败时 `checkHealth()` 返回 `false`，UI 切换降级提示
- 后续扩展云端 API 时，实现同一 interface 即可

## 7. 视觉设计方向

| 维度 | 选择 |
|------|------|
| 风格 | 工具型、干净专业 |
| 主题 | 浅色为主，支持暗色（后续） |
| 主色 | 深青 `#0D9488` + 琥珀强调 `#F59E0B` |
| 字体 | 中文「思源黑体/Noto Sans SC」+ 英文「DM Sans」 |
| 布局 | 大三栏：上传 | 预览 | 参数，预览区占比最大 |
| 语言 | 简体中文界面 |

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 上传非图片文件 | Toast 提示「请上传 JPG/PNG/WebP」 |
| 图片过大（>20MB） | 提示压缩或换图 |
| AI 服务离线 | 状态灯变红 + 引导启动 / 降级 opencv |
| AI 处理超时（>60s） | 提示重试或换手动模式 |
| opencv.js 加载失败 | 隐藏降级选项，仅提示启动 AI 服务 |
| 导出失败 | Toast 提示重试 |

## 9. MVP 范围边界

### 包含

- [x] 双 Tab：添加水印 / 去除水印
- [x] 文字 + Logo + 平铺完整加水印能力
- [x] 去水印：自动 + 手动 + opencv.js 降级
- [x] 本机 IOPaint Docker 配置
- [x] AI 服务状态检测与设置
- [x] PNG/JPEG 导出

### 不包含（后续迭代）

- [ ] 用户登录 / 云端历史
- [ ] 批量处理
- [ ] 付费云 API 接入
- [ ] 视频水印
- [ ] 移动端适配优化
- [ ] 暗色主题
- [ ] 水印模板预设

## 10. 部署与使用方式

| 组件 | 部署 | 费用 |
|------|------|------|
| 前端 | GitHub Pages / Cloudflare Pages / Vercel 静态 | 免费 |
| 本机 AI | 用户自行 `docker compose up` | 免费 |
| 整体 | 打开网页即可加水印；去水印需本机起 AI 服务 | 零月费 |

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 用户不愿装 Docker | 提供 opencv.js 降级 + 详细图文启动指南 |
| opencv.js 体积大（~8MB） | 懒加载，仅在去水印 Tab 按需加载 |
| IOPaint API 变更 | 前端 adapter 层隔离 |
| 自动去水印效果不稳定 | 默认推荐手动框选；自动模式标注「实验性」 |
| 大图片浏览器卡顿 | 预览时缩略，导出/处理时用原图 |

## 12. 验收标准

1. 上传图片后可添加文字/Logo 水印，实时预览，导出 PNG/JPEG
2. 平铺水印可正常显示，间距/角度可调
3. 本机 AI 在线时，手动框选去水印效果可接受（LaMa 修复）
4. AI 离线时，opencv.js 降级可对简单文字水印做基本修复
5. AI 服务状态指示准确，设置页可修改地址
6. 全程添加水印不上传任何数据；去水印本机模式下数据不出本机
7. 中文界面，核心流程 3 步内完成
