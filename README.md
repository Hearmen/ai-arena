# AI Arena

AI 竞技场 — 让 AI 互相批判，帮助用户获得多视角思考。

## 功能

- **左侧面板**：ChatGPT 网页版，用户正常与 ChatGPT 对话
- **右侧面板**：Kimi 网页版，展示 Kimi 的批判性分析
- **一键分析**：在 ChatGPT 页面点击"让 Kimi 分析"，Kimi 自动给出批判性审视意见

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+
- Chrome 浏览器
- Kimi API Key（从 [Moonshot 开放平台](https://platform.moonshot.cn/) 获取）

### 1. 克隆并进入项目

```bash
cd ai-arena
```

### 2. 配置环境变量

```bash
cp .env.example backend/.env
# 编辑 backend/.env，填入你的 KIMI_API_KEY
```

### 3. 启动后端

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:5173 运行。

### 5. 安装 Chrome 扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目中的 `extension/` 目录

### 6. 使用

1. 在左侧 ChatGPT 面板中登录并正常对话
2. 聊完一个话题后，点击 ChatGPT 页面上的"🎯 让 Kimi 分析"按钮
3. 在右侧 Kimi 面板中查看批判性分析结果

## 项目结构

```
ai-arena/
├── backend/          # Python/FastAPI 后端
│   ├── main.py       # WebSocket 服务端
│   ├── api/kimi.py   # Kimi API 调用
│   ├── prompts/      # System prompts
│   └── test_integration.py  # 集成测试
├── extension/        # Chrome 扩展
│   ├── manifest.json
│   ├── background.js # WebSocket 客户端
│   ├── content_chatgpt.js  # ChatGPT 页面注入
│   └── content_kimi.js     # Kimi 页面注入
├── frontend/         # React 前端
│   └── src/
│       ├── App.jsx
│       └── components/
└── docs/             # 设计文档
```

## 技术架构

- **Chrome Extension MV3**: 注入 ChatGPT 和 Kimi 页面，抓取/操作对话
- **FastAPI + Socket.IO**: WebSocket 服务端，调用 Kimi API
- **React + Vite**: 左右分栏布局，承载两个 iframe

## 常见问题

**Q: 扩展无法注入页面？**
A: 确保在 `chrome://extensions/` 中已启用扩展，并刷新 ChatGPT/Kimi 页面。

**Q: 后端连接失败？**
A: 检查后端是否运行在 `localhost:8000`，以及 `.env` 中的配置是否正确。

**Q: Kimi 没有自动发送分析？**
A: 确保已登录 Kimi 网页版，且页面完全加载。如果仍失败，可以手动复制分析内容粘贴发送。

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
