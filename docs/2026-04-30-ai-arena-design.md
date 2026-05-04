# AI 竞技场 — 设计文档

**日期**: 2026-04-30  
**版本**: v1.0  
**状态**: 已确认

---

## 1. 产品概述

**AI 竞技场**是一个浏览器内的 AI 对话辅助工具，帮助用户获得批判性多视角思考。

- **左侧面板**：ChatGPT 网页版（chatgpt.com），用户正常与 ChatGPT 对话
- **右侧面板**：Kimi 网页版（moonshot.cn），展示 Kimi 对 ChatGPT 对话的批判性分析
- **核心机制**：Chrome 扩展抓取 ChatGPT 对话 → WebSocket 发送到本地后端 → 调用 Kimi API → 扩展自动将分析结果填入 Kimi 输入框并发送

### 1.1 核心场景

1. 用户在左侧与 ChatGPT 讨论某个话题
2. 聊完一个话题后，用户点击"让 Kimi 分析"按钮
3. Kimi 基于完整对话历史，给出批判性审视意见
4. 用户在右侧看到 Kimi 的分析，获得不同视角

---

## 2. 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                     浏览器（React 页面）                       │
│                                                              │
│   ┌────────────────────────┐  ┌────────────────────────┐    │
│   │  iframe                │  │  iframe                │    │
│   │  chatgpt.com           │  │  moonshot.cn           │    │
│   │  (用户与 ChatGPT 聊天)  │  │  (Kimi 展示批判分析)    │    │
│   └───────────┬────────────┘  └───────────┬────────────┘    │
│               │                           ▲                 │
│               │    ┌─────────────────┐    │                 │
│               └───►│  Chrome Extension │◄───┘                 │
│                    │  - content_script │                        │
│                    │    (注入两个 iframe)│                        │
│                    │  - background     │                        │
│                    │    (WebSocket 客户端)│                       │
│                    └────────┬────────┘                        │
│                             │ WebSocket                       │
│                    ┌────────┴────────┐                        │
│                    │  Python/FastAPI │                        │
│                    │    本地后端       │                        │
│                    │  - WebSocket 服务端 │                      │
│                    │  - Kimi API 调用  │                      │
│                    └─────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 组件详情

### 3.1 Chrome 扩展（MV3）

**manifest.json：**

```json
{
  "manifest_version": 3,
  "name": "AI Arena Bridge",
  "version": "1.0.0",
  "description": "连接 ChatGPT 与 Kimi，提供批判性多视角分析",
  "permissions": ["activeTab"],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://moonshot.cn/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*"],
      "js": ["content_chatgpt.js"],
      "all_frames": true,
      "run_at": "document_idle"
    },
    {
      "matches": ["https://moonshot.cn/*"],
      "js": ["content_kimi.js"],
      "all_frames": true,
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

**content_chatgpt.js：**

职责：
- 监听页面 DOM 变化（MutationObserver）
- 识别对话消息结构，提取用户和 ChatGPT 的对话历史
- 在页面上注入"发送到 Kimi 分析"浮动按钮
- 点击后收集完整对话，通过 `chrome.runtime.sendMessage` 发送给 background

提取的数据格式：
```json
{
  "messages": [
    {"role": "user", "content": "用户消息内容"},
    {"role": "assistant", "content": "ChatGPT 回复内容"}
  ],
  "timestamp": "2026-04-30T10:00:00Z"
}
```

**content_kimi.js：**

职责：
- 监听来自 background 的消息
- 定位 Kimi 网页版的输入框 DOM 元素
- 自动填充分析内容到输入框
- 模拟点击发送按钮

**background.js：**

职责：
- WebSocket 客户端，连接本地后端（`ws://localhost:8000/ws`）
- 接收 content_chatgpt.js 的对话数据，通过 WebSocket 发送给后端
- 接收后端返回的 Kimi 分析结果，转发给 content_kimi.js
- 管理连接状态、重连逻辑（指数退避）

### 3.2 本地后端（Python/FastAPI）

**技术栈：**
- FastAPI + `python-socketio`（异步模式）
- `httpx` 用于异步 HTTP 请求调用 Kimi API
- `python-dotenv` 管理环境变量

**核心模块：**

```python
# main.py 伪代码
from fastapi import FastAPI
import socketio

app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def analyze_conversation(sid, data):
    """
    接收对话数据，调用 Kimi API，流式返回分析结果
    """
    messages = data["messages"]
    
    # 组装 system prompt + 对话历史
    prompt = build_critic_prompt(messages)
    
    # 调用 Kimi API（流式）
    full_text = ""
    async for chunk in call_kimi_api_stream(prompt):
        full_text += chunk
        await sio.emit("analysis_chunk", {"chunk": chunk}, to=sid)
    
    # 发送完整结果
    await sio.emit("analysis_complete", {"full_text": full_text}, to=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
```

**Kimi API 调用模块（api/kimi.py）：**

- 封装 Moonshot API 调用
- 支持流式响应（SSE）
- 错误处理（重试、超时、API 限流）

**Kimi System Prompt：**

```
你是一位批判性思维专家。用户正在与 ChatGPT 讨论一个话题。
请基于以下对话历史，提供批判性分析：

1. 指出 ChatGPT 观点中可能存在的漏洞、偏见或过度简化
2. 提出被忽略的不同视角或反方论据
3. 建议用户进一步思考的方向
4. 保持客观、理性，不要为反对而反对

对话历史：
{conversation_history}

请用中文给出你的分析，结构清晰，分点论述。
```

### 3.3 前端页面（React）

**技术栈：**
- React 18 + Vite
- Tailwind CSS（样式）
- 纯前端，无额外状态管理库（规模小，useState/useContext 足够）

**布局：**

```
┌─────────────────────────────────────────────────────────────┐
│  [AI Arena]  [状态: 已连接]  [设置]                          │  ← 顶部导航栏
├─────────────────────────────┬───────────────────────────────┤
│                             │                               │
│      ChatGPT                │         Kimi                  │
│      iframe                 │         iframe                │
│                             │                               │
│                             │                               │
│                             │                               │
├─────────────────────────────┴───────────────────────────────┤
│  [扩展已就绪]  [后端运行中]                                    │  ← 底部状态栏
└─────────────────────────────────────────────────────────────┘
```

**核心组件：**

- `App.jsx`：主应用，管理全局状态（连接状态、配置）
- `Layout.jsx`：左右分栏布局
- `StatusBar.jsx`：显示扩展 ↔ 后端连接状态
- `ConfigPanel.jsx`：配置面板（后端地址、API Key）

**功能：**
- 显示 WebSocket 连接状态（扩展 ↔ 后端）
- 提供配置入口（后端地址、Kimi API Key）
- 左右 iframe 加载对应网页

---

## 4. 数据流详细时序

```
用户与 ChatGPT 聊完一个话题
        │
        ▼
用户点击扩展注入的"让 Kimi 分析"按钮
        │
        ▼
content_chatgpt.js 扫描 DOM，提取对话历史
        │
        ▼
chrome.runtime.sendMessage() → background.js
        │
        ▼
background.js 通过 WebSocket 发送给 FastAPI 后端
        │
        ▼
后端组装 prompt，调用 Kimi API（流式 SSE）
        │
        ▼
后端聚合完整文本，通过 WebSocket 发送给 background
        │
        ▼
background.js 发送给 content_kimi.js
        │
        ▼
content_kimi.js 定位 Kimi 输入框，填充文本，模拟点击发送
        │
        ▼
用户在右侧面板看到 Kimi 的批判性分析
```

---

## 5. 技术挑战与应对方案

| 挑战 | 应对方案 |
|------|---------|
| ChatGPT DOM 结构变化 | 使用相对稳定的 CSS 选择器，建立选择器配置化机制，定期更新扩展 |
| Kimi 网页版 DOM 变化 | 同上，扩展支持配置化选择器，便于快速适配 |
| 跨域 iframe 注入 | `manifest.json` 中配置 `all_frames: true` 和对应域名权限 |
| WebSocket 连接断开 | background.js 实现自动重连机制（指数退避） |
| Kimi API 流式响应 | 后端聚合完整文本后再发送给扩展，避免 iframe 操作过于频繁 |
| 用户未登录 Kimi | 右侧面板显示提示，引导用户登录 |
| API Key 安全存储 | 存储在本地后端环境变量中，不暴露在前端或扩展 |

---

## 6. 项目结构

```
ai-arena/
├── README.md
├── .env.example              # 环境变量模板
│
├── backend/                  # Python/FastAPI 后端
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── api/
│   │   ├── __init__.py
│   │   └── kimi.py          # Kimi API 调用封装
│   ├── prompts/
│   │   └── critic.txt       # Kimi system prompt
│   └── utils/
│       └── websocket.py     # WebSocket 工具函数
│
├── extension/                # Chrome 扩展
│   ├── manifest.json
│   ├── background.js
│   ├── content_chatgpt.js
│   ├── content_kimi.js
│   ├── popup.html
│   ├── popup.js
│   └── styles.css
│
├── frontend/                 # React 前端
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── StatusBar.jsx
│       │   └── ConfigPanel.jsx
│       └── hooks/
│           └── useWebSocket.js
│
└── docs/
    └── 2026-04-30-ai-arena-design.md   # 本设计文档
```

---

## 7. 环境变量

后端 `.env` 文件：

```env
# Kimi API (Moonshot)
KIMI_API_KEY=your_kimi_api_key_here
KIMI_API_BASE=https://api.moonshot.cn/v1
KIMI_MODEL=moonshot-v1-8k

# 后端配置
HOST=0.0.0.0
PORT=8000

# 扩展通信密钥（可选，用于验证扩展身份）
EXTENSION_SECRET=your_secret_here
```

---

## 8. 后续可扩展功能

- **多模型支持**：不仅 Kimi，还可接入 Claude、Gemini 等作为"第三方观点"
- **历史记录**：保存每次分析的记录，便于回顾
- **分析模板**：用户可自定义 Kimi 的分析角度（如"商业视角"、"技术视角"、"伦理视角"）
- **自动触发**：可选配置，当 ChatGPT 回复超过一定长度自动触发分析
- **对话导出**：支持导出完整的"三方对话"记录
- **快捷键支持**：如 Ctrl+Shift+K 快速触发分析

---

## 9. 成功标准

- [ ] 用户可以正常在左侧与 ChatGPT 对话
- [ ] 点击"分析"按钮后，Kimi 能在右侧给出相关批判性分析
- [ ] 扩展能稳定抓取 ChatGPT 对话内容
- [ ] 扩展能稳定操作 Kimi 网页版发送消息
- [ ] WebSocket 通信稳定，支持断线重连
- [ ] 整体体验流畅，无明显卡顿
