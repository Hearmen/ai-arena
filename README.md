# AI Arena

AI 竞技场 — 让 AI 互相批判，帮助用户获得多视角思考。

> **纯浏览器扩展，无需后端，无需 API Key。**

## 功能

- **多 Host 平台支持**：在 ChatGPT、Gemini、Kimi、豆包 页面均可使用
- **右侧面板切换**：支持 Kimi / 豆包 作为分析面板，也可选择关闭
- **一键分析**：在当前对话页面点击分析按钮，自动将完整对话历史包装成批判性 prompt 填入右侧面板
- **布局自适应**：面板展开时主内容区自动收缩，不遮挡对话
- **可拖拽调整宽度**：拖动面板左边缘自由调整宽度
- **Prompt 自定义**：通过扩展弹出页面自定义分析 prompt 模板

## 支持的平台

| 平台 | 作为 Host（当前页面） | 作为 Panel（右侧面板） |
|------|:-------------------:|:--------------------:|
| ChatGPT | ✅ | ❌ |
| Gemini | ✅ | ❌ |
| Kimi | ✅ | ✅ |
| 豆包 | ✅ | ✅ |

## 工作原理

1. 用户在任意支持的 AI 平台（Host）正常对话
2. 点击"让 XX 分析"按钮，扩展抓取**完整对话历史**
3. 扩展**在本地**将对话包装成批判性分析 prompt
4. 通过 `postMessage` 将 prompt 发送给右侧面板（Panel）
5. 面板自动填入 prompt 并发送
6. 给出批判性分析

## 快速开始

### 前置要求

- Chrome 浏览器（或 Edge、Arc 等 Chromium 内核浏览器）

### 安装扩展

1. 克隆仓库

```bash
git clone https://github.com/Hearmen/ai-arena.git
cd ai-arena
```

2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目中的 `extension/` 目录

### 使用

1. 打开任意支持的 AI 平台（ChatGPT / Gemini / Kimi / 豆包）并登录，正常对话
2. 点击右下角 🎯 浮动按钮展开右侧面板（首次使用需登录面板平台）
3. 点击输入区旁的"🎯 让 XX 分析"按钮
4. 右侧面板会自动收到 prompt 并给出批判性分析

### 切换分析平台

1. 点击浏览器工具栏上的 AI Arena 扩展图标
2. 在弹出页面中选择：
   - **Kimi** — 使用 Kimi 作为分析面板
   - **豆包** — 使用豆包作为分析面板
   - **关闭** — 禁用扩展功能，不显示按钮和面板
3. 设置会自动保存并应用到当前页面

### 自定义 Prompt

1. 点击 AI Arena 扩展图标打开弹出页面
2. 在"分析 Prompt 模板"文本框中编辑
3. 保留 `{conversation_history}` 占位符
4. 点击"应用到当前页面"

## 项目结构

```
ai-arena/
├── extension/              # Chrome 扩展 (MV3)
│   ├── manifest.json
│   ├── background.js       # Service Worker — CSP 放松处理
│   ├── popup.html/js       # 扩展弹出页面 — 平台选择、Prompt 自定义
│   ├── host/               # Host 平台适配器
│   │   ├── _core.js        # 面板生命周期、模型切换、PostMessage
│   │   ├── _ui.js          # UI 组件工厂
│   │   ├── prompt.js       # Prompt 构建器
│   │   ├── chatgpt.js      # ChatGPT Host 适配器
│   │   ├── gemini.js       # Gemini Host 适配器
│   │   ├── kimi_host.js    # Kimi Host 适配器
│   │   └── doubao_host.js  # 豆包 Host 适配器
│   ├── panel/              # Panel 自动发送脚本
│   │   ├── kimi.js         # Kimi 页面 — 接收 postMessage、自动填入发送
│   │   └── doubao.js       # 豆包页面 — 接收 postMessage、自动填入发送
│   ├── shared/             # 共享模块
│   │   ├── registry.js     # 平台与模型注册中心
│   │   └── utils.js        # 工具函数
│   └── icon*.png
├── docs/                   # 设计文档
│   ├── 2026-04-30-ai-arena-v2-design.md
│   └── superpowers/
│       ├── specs/          # 设计规格
│       └── plans/          # 实施计划
├── frontend/               # 前端 React 应用（独立预览）
└── README.md
```

## 技术架构

- **Chrome Extension MV3**
  - `background.js`: Service Worker，通过 `webRequest` 放松 Host 页面的 CSP `frame-src` 限制
  - `host/*.js`: 各平台 Host 适配器 — 提取对话、注入 UI、调整布局
  - `panel/*.js`: Panel 自动发送脚本 — 监听 `window.postMessage`，自动填入输入框并发送
  - `popup.html/js`: 扩展弹出页面 — 平台选择、Prompt 模板自定义
- **无后端**: prompt 包装逻辑完全在扩展本地完成
- **无前端依赖**: 核心功能不依赖独立的 React/Vite 前端页面

## 常见问题

**Q: 扩展无法注入页面？**
A: 确保在 `chrome://extensions/` 中已启用扩展，并刷新对应页面。

**Q: 浮动按钮或分析按钮未出现？**
A: 各平台 UI 经常更新，扩展会自动重试注入。如果长时间未出现，请打开 DevTools (F12) 查看 Console 中的 `[AI Arena]` 日志，并提交 issue。

**Q: 面板加载失败或被 CSP 拦截？**
A: 扩展已内置 `background.js` 自动放松 CSP `frame-src` 限制。如果仍失败，尝试刷新页面或重新加载扩展。

**Q: 右侧面板遮挡页面内容？**
A: 扩展会自动调整主内容区域的 `marginRight`。如果某个平台遮挡严重，请提交 issue 并说明平台名称。

**Q: Kimi/豆包 没有自动发送分析？**
A: 确保已登录对应平台的网页版，且页面完全加载。如果仍失败，可以手动复制 prompt 粘贴发送。

**Q: 需要 API Key 吗？**
A: 不需要。本项目直接使用各 AI 平台的网页版，通过扩展自动填入 prompt，由平台网页版自己生成回复。

**Q: 支持其他浏览器吗？**
A: 理论上支持所有 Chromium 内核浏览器（Edge、Arc、Brave 等），但未经过测试。

## License

MIT
