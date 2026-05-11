# AI Arena

AI 竞技场 — 让 AI 互相批判，帮助用户获得多视角思考。

> **纯浏览器扩展，无需后端，无需 API Key。**

## 功能

- **右侧 Kimi 分析面板**：在 ChatGPT 页面内嵌入 Kimi 网页版面板
- **一键分析**：在 ChatGPT 页面点击"🎯 让 Kimi 分析"，自动将完整对话历史包装成批判性 prompt 填入 Kimi 输入框
- **布局自适应**：面板展开时 ChatGPT 内容区自动收缩，不遮挡对话
- **可拖拽调整宽度**：拖动面板左边缘自由调整宽度

## 工作原理

1. 用户在 ChatGPT 网页版正常对话
2. 点击"🎯 让 Kimi 分析"按钮，扩展抓取**完整对话历史**
3. 扩展**在本地**将对话包装成批判性分析 prompt
4. 通过 `postMessage` 将 prompt 发送给右侧 Kimi 面板
5. Kimi 面板自动填入 prompt 并发送
6. Kimi 基于 prompt 给出批判性分析

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

1. 打开 [chatgpt.com](https://chatgpt.com) 并登录，正常对话
2. 点击右下角 🎯 浮动按钮展开右侧 Kimi 面板（首次使用需登录 [kimi.com](https://kimi.com)）
3. 聊完一个话题后，点击 ChatGPT 输入区旁的"🎯 让 Kimi 分析"按钮
4. 右侧 Kimi 面板会自动收到 prompt 并给出批判性分析

## 项目结构

```
ai-arena/
├── extension/              # Chrome 扩展 (MV3) — 全部逻辑在此
│   ├── manifest.json
│   ├── content_chatgpt.js  # ChatGPT 页面：提取对话、注入面板和按钮、本地包装 prompt
│   ├── content_kimi.js     # Kimi 页面（含 iframe）：接收 postMessage、自动填入发送
│   ├── core/
│   │   └── prompt-builder.js   # 批判性 prompt 模板
│   ├── popup.html/js       # 扩展信息弹窗
│   └── icon*.png
├── docs/                   # 设计文档
│   └── 2026-04-30-ai-arena-v2-design.md
└── README.md
```

## 技术架构

- **Chrome Extension MV3**: 唯一运行时代码
  - `content_chatgpt.js`: 注入 ChatGPT 页面，提取对话，创建右侧面板（iframe 加载 kimi.com），注入分析按钮，本地构建 prompt
  - `content_kimi.js`: 注入 Kimi 页面，监听 `window.postMessage`，自动填入输入框并发送
- **无后端**: prompt 包装逻辑完全在扩展本地完成
- **无前端**: 不再需要独立的 React/Vite 前端页面，面板直接嵌入 ChatGPT 页面

## 常见问题

**Q: 扩展无法注入页面？**
A: 确保在 `chrome://extensions/` 中已启用扩展，并刷新 ChatGPT/Kimi 页面。

**Q: 浮动按钮或分析按钮未出现？**
A: ChatGPT UI 经常更新，扩展会自动重试注入。如果长时间未出现，请打开 DevTools (F12) 查看 Console 中的 `[AI Arena]` 日志，并提交 issue。

**Q: Kimi 没有自动发送分析？**
A: 确保已登录 Kimi 网页版 (kimi.com)，且页面完全加载。如果仍失败，可以手动复制 prompt 粘贴发送。

**Q: 需要 Kimi API Key 吗？**
A: 不需要。本项目直接使用 Kimi 网页版 (kimi.com)，通过扩展自动填入 prompt，由 Kimi 网页版自己生成回复。

**Q: 支持其他浏览器吗？**
A: 理论上支持所有 Chromium 内核浏览器（Edge、Arc、Brave 等），但未经过测试。

## License

MIT
