# AI Arena

AI 竞技场 — 让 AI 互相批判，帮助用户获得多视角思考。

## 功能

- **左侧面板**：ChatGPT 网页版，用户正常与 ChatGPT 对话
- **右侧面板**：Kimi 网页版 (kimi.com)，Kimi 根据左侧对话给出批判性审视意见
- **一键分析**：在 ChatGPT 页面点击"让 Kimi 分析"，自动将对话包装成批判性 prompt 填入 Kimi 输入框

## 工作原理

1. 用户在左侧与 ChatGPT 正常对话
2. 点击"🎯 让 Kimi 分析"按钮，扩展抓取对话内容
3. 后端将对话包装成批判性分析 prompt（不需要 API Key）
4. 扩展自动将 prompt 填入右侧 Kimi 网页版的输入框并发送
5. Kimi 基于 prompt 给出批判性分析

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+
- Chrome 浏览器

### 1. 克隆并进入项目

```bash
cd ai-arena
```

### 2. 启动后端

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:5173 运行。

### 4. 安装 Chrome 扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目中的 `extension/` 目录

### 5. 使用

1. 在左侧 ChatGPT 面板中登录并正常对话
2. 聊完一个话题后，点击 ChatGPT 页面上的"🎯 让 Kimi 分析"按钮
3. 右侧 Kimi 面板会自动收到 prompt 并给出批判性分析

## 项目结构

```
ai-arena/
├── backend/          # Python/FastAPI 后端（透传 + prompt 包装）
│   ├── main.py       # WebSocket 服务端
│   ├── requirements.txt
│   ├── utils/
│   │   └── websocket.py
│   └── test_integration.py  # 集成测试
├── extension/        # Chrome 扩展 (MV3)
│   ├── manifest.json
│   ├── background.js # WebSocket 客户端
│   ├── content_chatgpt.js  # ChatGPT 页面注入（抓取对话）
│   ├── content_kimi.js     # Kimi 页面注入（自动填入 + 发送）
│   ├── popup.html/js       # 扩展设置弹窗
│   └── icon*.png
├── frontend/         # React + Vite 前端
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── Layout.jsx     # 左右分栏 iframe
│           └── StatusBar.jsx  # 后端连接状态
└── docs/             # 设计文档
```

## 技术架构

- **Chrome Extension MV3**: 注入 ChatGPT 和 Kimi 页面，抓取/操作对话
- **FastAPI + Socket.IO**: WebSocket 透传服务端，将对话包装成批判性 prompt
- **React + Vite**: 左右分栏布局，承载两个 iframe

## 常见问题

**Q: 扩展无法注入页面？**
A: 确保在 `chrome://extensions/` 中已启用扩展，并刷新 ChatGPT/Kimi 页面。

**Q: 后端连接失败？**
A: 检查后端是否运行在 `localhost:8000`。

**Q: Kimi 没有自动发送分析？**
A: 确保已登录 Kimi 网页版 (kimi.com)，且页面完全加载。如果仍失败，可以手动复制 prompt 粘贴发送。

**Q: 需要 Kimi API Key 吗？**
A: 不需要。本项目直接使用 Kimi 网页版 (kimi.com)，通过扩展自动填入 prompt，由 Kimi 网页版自己生成回复。

## 测试

### 后端集成测试

确保后端正在运行，然后执行：

```bash
cd backend
source venv/bin/activate
pytest test_integration.py -v
```

## License

MIT
