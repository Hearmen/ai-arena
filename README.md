# AI Arena

AI 竞技场 — 让 AI 互相批判，帮助用户获得多视角思考。

## 快速开始

### 1. 启动后端

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 3. 安装扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension/` 目录

### 4. 配置

复制 `.env.example` 到 `backend/.env`，填入你的 Kimi API Key。

## 架构

- **Chrome Extension**: 注入 ChatGPT 和 Kimi 页面，抓取/操作对话
- **FastAPI Backend**: WebSocket 服务端，调用 Kimi API
- **React Frontend**: 左右分栏布局，承载两个 iframe
