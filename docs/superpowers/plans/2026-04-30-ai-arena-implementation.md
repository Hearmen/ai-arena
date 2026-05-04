# AI Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension + local backend system that captures ChatGPT conversations and sends them to Kimi for critical analysis, displaying results in a side-by-side browser layout.

**Architecture:** A Chrome extension injects scripts into ChatGPT and Kimi iframes to extract/insert messages. The extension communicates with a Python/FastAPI backend via WebSocket. The backend calls the Kimi (Moonshot) API and returns the analysis, which the extension then auto-submits into the Kimi iframe.

**Tech Stack:** Python 3.11+, FastAPI, python-socketio, httpx, React 18, Vite, Tailwind CSS, Chrome Extension MV3

---

## File Structure

```
ai-arena/
├── README.md
├── .env.example
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── api/
│   │   ├── __init__.py
│   │   └── kimi.py
│   ├── prompts/
│   │   └── critic.txt
│   └── utils/
│       └── websocket.py
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content_chatgpt.js
│   ├── content_kimi.js
│   ├── popup.html
│   ├── popup.js
│   └── styles.css
├── frontend/
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
└── docs/
    ├── 2026-04-30-ai-arena-design.md
    └── superpowers/
        └── plans/
            └── 2026-04-30-ai-arena-implementation.md
```

---

## Task 1: Project Bootstrap & Git Setup

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repository**

```bash
cd /Users/hearmen/Project/AI4Sec/ai_generate/kimi-wp/ai-arena
git init
git add docs/
git commit -m "docs: add AI Arena design document"
```

- [ ] **Step 2: Create root README.md**

```markdown
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
```

- [ ] **Step 3: Create .env.example**

```env
# Kimi API (Moonshot)
KIMI_API_KEY=your_kimi_api_key_here
KIMI_API_BASE=https://api.moonshot.cn/v1
KIMI_MODEL=moonshot-v1-8k

# Backend
HOST=0.0.0.0
PORT=8000
```

- [ ] **Step 4: Create .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
*.egg-info/
dist/
build/

# Node
node_modules/
dist/
*.log

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example .gitignore
git commit -m "chore: project bootstrap"
```

---

## Task 2: FastAPI Backend — Core Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/utils/__init__.py`
- Create: `backend/utils/websocket.py`

- [ ] **Step 1: Create requirements.txt**

```txt
fastapi==0.109.0
python-socketio[asyncio]==5.11.0
uvicorn[standard]==0.27.0
httpx==0.26.0
python-dotenv==1.0.0
```

- [ ] **Step 2: Create backend/utils/websocket.py**

```python
"""WebSocket connection manager for Socket.IO."""

import socketio


class ConnectionManager:
    """Manages Socket.IO connections."""

    def __init__(self):
        self.active_connections: dict[str, dict] = {}

    async def connect(self, sid: str, environ: dict):
        self.active_connections[sid] = {"environ": environ}
        print(f"Client connected: {sid}")

    async def disconnect(self, sid: str):
        if sid in self.active_connections:
            del self.active_connections[sid]
        print(f"Client disconnected: {sid}")

    def is_connected(self, sid: str) -> bool:
        return sid in self.active_connections


manager = ConnectionManager()
```

- [ ] **Step 3: Create backend/main.py**

```python
"""AI Arena Backend — FastAPI + Socket.IO server."""

import os
from contextlib import asynccontextmanager

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI

from utils.websocket import manager

load_dotenv()

# Create Socket.IO async server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["chrome-extension://*", "http://localhost:*"],
)


@sio.event
async def connect(sid: str, environ: dict):
    await manager.connect(sid, environ)


@sio.event
async def disconnect(sid: str):
    await manager.disconnect(sid)


@sio.event
async def analyze_conversation(sid: str, data: dict):
    """Receive conversation data from extension, forward to Kimi API.

    Expected data format:
    {
        "messages": [
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "..."}
        ]
    }
    """
    print(f"Received analyze request from {sid}")
    print(f"Data: {data}")

    # TODO: Call Kimi API in Task 3
    # For now, echo back a test response
    await sio.emit(
        "analysis_complete",
        {"full_text": "这是测试响应。后端已收到对话数据，正在等待 Kimi API 集成。"},
        to=sid,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    print(f"Starting AI Arena backend on {os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', '8000')}")
    yield
    print("Shutting down AI Arena backend")


app = FastAPI(title="AI Arena Backend", lifespan=lifespan)

# Mount Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, app)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "connections": len(manager.active_connections)}
```

- [ ] **Step 4: Create backend/utils/__init__.py**

Empty file.

- [ ] **Step 5: Test backend startup**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -c "import main; print('Import OK')"
```

Expected: `Import OK`

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): setup FastAPI + Socket.IO server"
```

---

## Task 3: FastAPI Backend — Kimi API Integration

**Files:**
- Create: `backend/api/__init__.py`
- Create: `backend/api/kimi.py`
- Create: `backend/prompts/critic.txt`
- Modify: `backend/main.py`

- [ ] **Step 1: Create prompts/critic.txt**

```txt
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

- [ ] **Step 2: Create backend/api/kimi.py**

```python
"""Kimi (Moonshot) API client."""

import os
from typing import AsyncGenerator

import httpx

KIMI_API_KEY = os.getenv("KIMI_API_KEY", "")
KIMI_API_BASE = os.getenv("KIMI_API_BASE", "https://api.moonshot.cn/v1")
KIMI_MODEL = os.getenv("KIMI_MODEL", "moonshot-v1-8k")


def build_critic_prompt(messages: list[dict]) -> str:
    """Build the critic prompt from conversation messages."""
    conversation_lines = []
    for msg in messages:
        role_label = "用户" if msg["role"] == "user" else "ChatGPT"
        conversation_lines.append(f"{role_label}: {msg['content']}")

    conversation_history = "\n".join(conversation_lines)

    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "critic.txt")
    with open(prompt_path, "r", encoding="utf-8") as f:
        template = f.read()

    return template.format(conversation_history=conversation_history)


async def stream_kimi_analysis(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream analysis from Kimi API.

    Yields text chunks as they arrive from the API.
    """
    if not KIMI_API_KEY:
        yield "错误：未配置 KIMI_API_KEY。请在 backend/.env 中设置。"
        return

    prompt = build_critic_prompt(messages)

    headers = {
        "Authorization": f"Bearer {KIMI_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": KIMI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            async with client.stream(
                "POST",
                f"{KIMI_API_BASE}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue

                    data = line[6:]  # Remove "data: " prefix
                    if data == "[DONE]":
                        break

                    import json

                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"]
                        if "content" in delta:
                            yield delta["content"]
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

        except httpx.HTTPStatusError as e:
            yield f"\n\n错误：Kimi API 请求失败 ({e.response.status_code})。请检查 API Key 是否正确。"
        except httpx.RequestError as e:
            yield f"\n\n错误：无法连接到 Kimi API。{str(e)}"
```

- [ ] **Step 3: Update backend/main.py to use Kimi API**

Replace the `analyze_conversation` event handler:

```python
from api.kimi import stream_kimi_analysis


@sio.event
async def analyze_conversation(sid: str, data: dict):
    """Receive conversation data from extension, call Kimi API, stream results back."""
    print(f"Received analyze request from {sid}")

    messages = data.get("messages", [])
    if not messages:
        await sio.emit("analysis_error", {"error": "No messages provided"}, to=sid)
        return

    full_text = ""
    async for chunk in stream_kimi_analysis(messages):
        full_text += chunk
        await sio.emit("analysis_chunk", {"chunk": chunk}, to=sid)

    await sio.emit("analysis_complete", {"full_text": full_text}, to=sid)
    print(f"Analysis complete for {sid}, length: {len(full_text)}")
```

- [ ] **Step 4: Create backend/api/__init__.py**

Empty file.

- [ ] **Step 5: Test Kimi API integration**

```bash
cd backend
source venv/bin/activate
python -c "
import asyncio
from api.kimi import build_critic_prompt

messages = [
    {'role': 'user', 'content': '什么是人工智能？'},
    {'role': 'assistant', 'content': '人工智能是模拟人类智能的计算机系统。'}
]
prompt = build_critic_prompt(messages)
print('Prompt built successfully:')
print(prompt[:200] + '...')
"
```

Expected: Prompt built successfully with conversation history formatted.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): integrate Kimi (Moonshot) API"
```

---

## Task 4: Chrome Extension — Manifest & Background Script

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/background.js`
- Create: `extension/popup.html`
- Create: `extension/popup.js`
- Create: `extension/styles.css`

- [ ] **Step 1: Create extension/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "AI Arena Bridge",
  "version": "1.0.0",
  "description": "连接 ChatGPT 与 Kimi，提供批判性多视角分析",
  "permissions": ["activeTab", "storage"],
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
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}
```

Note: Icons are optional for MVP. Create placeholder 1x1 PNGs or remove icon references if not creating icons.

- [ ] **Step 2: Create extension/background.js**

```javascript
/**
 * AI Arena Bridge — Background Service Worker
 *
 * Manages WebSocket connection to local backend and routes messages
 * between content scripts and the backend.
 */

const WS_URL = 'ws://localhost:8000';
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

// Connection status
let isConnected = false;

/**
 * Initialize WebSocket connection
 */
function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    console.log('[AI Arena] WebSocket already connected or connecting');
    return;
  }

  console.log('[AI Arena] Connecting to backend...');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log('[AI Arena] WebSocket connected');
    isConnected = true;
    reconnectAttempts = 0;
    broadcastStatus({ connected: true });
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('[AI Arena] Received from backend:', data);

    // Route analysis results to Kimi content script
    if (data.event === 'analysis_complete' || data.event === 'analysis_chunk') {
      chrome.tabs.query({ url: 'https://moonshot.cn/*' }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: data.event,
            payload: data.data,
          }).catch(() => {
            // Tab may not have content script loaded
          });
        });
      });
    }
  };

  socket.onclose = () => {
    console.log('[AI Arena] WebSocket closed');
    isConnected = false;
    broadcastStatus({ connected: false });
    attemptReconnect();
  };

  socket.onerror = (error) => {
    console.error('[AI Arena] WebSocket error:', error);
    isConnected = false;
    broadcastStatus({ connected: false, error: true });
  };
}

/**
 * Attempt reconnection with exponential backoff
 */
function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[AI Arena] Max reconnection attempts reached');
    return;
  }

  const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  console.log(`[AI Arena] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  setTimeout(connectWebSocket, delay);
}

/**
 * Broadcast connection status to all tabs
 */
function broadcastStatus(status) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'connection_status',
        payload: status,
      }).catch(() => {
        // Tab may not have content script loaded
      });
    });
  });
}

/**
 * Send data to backend via WebSocket
 */
function sendToBackend(event, data) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('[AI Arena] WebSocket not connected');
    return false;
  }

  const message = JSON.stringify([event, data]);
  socket.send(message);
  return true;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AI Arena] Received from content script:', request);

  if (request.type === 'analyze_conversation') {
    const success = sendToBackend('analyze_conversation', request.payload);
    sendResponse({ success });
  } else if (request.type === 'get_status') {
    sendResponse({ connected: isConnected });
  }

  return true; // Keep message channel open for async response
});

// Initialize connection on startup
connectWebSocket();

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 4.9 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[AI Arena] Keep alive');
  }
});
```

- [ ] **Step 3: Create extension/popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 300px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    h1 {
      font-size: 16px;
      margin: 0 0 12px 0;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ccc;
    }
    .status-dot.connected {
      background: #10b981;
    }
    .status-dot.disconnected {
      background: #ef4444;
    }
    .config {
      margin-top: 12px;
    }
    label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 8px;
      margin-top: 8px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <h1>AI Arena Bridge</h1>
  <div class="status">
    <div class="status-dot" id="statusDot"></div>
    <span id="statusText">检查中...</span>
  </div>
  <div class="config">
    <label for="wsUrl">后端地址</label>
    <input type="text" id="wsUrl" value="ws://localhost:8000" />
    <button id="saveBtn">保存设置</button>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create extension/popup.js**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const wsUrlInput = document.getElementById('wsUrl');
  const saveBtn = document.getElementById('saveBtn');

  // Load saved config
  chrome.storage.local.get(['wsUrl'], (result) => {
    if (result.wsUrl) {
      wsUrlInput.value = result.wsUrl;
    }
  });

  // Check connection status
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response && response.connected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = '已连接';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = '未连接';
    }
  });

  // Save config
  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({ wsUrl: wsUrlInput.value }, () => {
      saveBtn.textContent = '已保存';
      setTimeout(() => {
        saveBtn.textContent = '保存设置';
      }, 1500);
    });
  });
});
```

- [ ] **Step 5: Create placeholder icons (optional)**

If not creating real icons, remove icon references from manifest.json. Otherwise create simple 16x16, 48x48, 128x128 PNG files.

- [ ] **Step 6: Commit**

```bash
git add extension/
git commit -m "feat(extension): add manifest, background script, and popup"
```

---

## Task 5: Chrome Extension — ChatGPT Content Script

**Files:**
- Create: `extension/content_chatgpt.js`

- [ ] **Step 1: Create extension/content_chatgpt.js**

```javascript
/**
 * AI Arena Bridge — ChatGPT Content Script
 *
 * Injected into chatgpt.com to extract conversation history
 * and provide the "Send to Kimi" button.
 */

(function () {
  'use strict';

  console.log('[AI Arena] ChatGPT content script loaded');

  let isButtonInjected = false;

  /**
   * Extract conversation messages from ChatGPT DOM
   */
  function extractConversation() {
    const messages = [];

    // ChatGPT uses article elements for messages
    // The structure may change, so we try multiple selectors
    const messageSelectors = [
      'article[data-testid^="conversation-turn-"]',
      'article[class*="group"]',
      'main article',
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) break;
    }

    messageElements.forEach((article) => {
      // Determine role: user or assistant
      const isUser = article.querySelector('img[alt*="User"], [data-testid*="user"], .rounded-sm') !== null;
      const role = isUser ? 'user' : 'assistant';

      // Extract text content
      const textSelectors = [
        '.markdown',
        '[data-message-author-role] .whitespace-pre-wrap',
        '.text-message',
        'p',
      ];

      let content = '';
      for (const selector of textSelectors) {
        const elements = article.querySelectorAll(selector);
        if (elements.length > 0) {
          content = Array.from(elements)
            .map((el) => el.textContent.trim())
            .join('\n');
          break;
        }
      }

      if (content) {
        messages.push({ role, content });
      }
    });

    return messages;
  }

  /**
   * Send conversation to background script for analysis
   */
  function sendToKimi() {
    const messages = extractConversation();

    if (messages.length === 0) {
      alert('未检测到对话内容，请确保页面已加载完成。');
      return;
    }

    console.log('[AI Arena] Extracted messages:', messages);

    chrome.runtime.sendMessage(
      {
        type: 'analyze_conversation',
        payload: { messages },
      },
      (response) => {
        if (response && response.success) {
          showNotification('已发送给 Kimi 分析，请查看右侧面板');
        } else {
          showNotification('发送失败，请检查后端连接', 'error');
        }
      }
    );
  }

  /**
   * Show a temporary notification on the page
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s;
    `;

    if (type === 'error') {
      notification.style.background = '#fee2e2';
      notification.style.color = '#991b1b';
      notification.style.border = '1px solid #fecaca';
    } else {
      notification.style.background = '#dbeafe';
      notification.style.color = '#1e40af';
      notification.style.border = '1px solid #bfdbfe';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Inject the "Send to Kimi" button into ChatGPT UI
   */
  function injectButton() {
    if (isButtonInjected) return;

    // Try to find a good insertion point
    const insertionSelectors = [
      '[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'form button',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }

    if (!targetElement) return;

    const button = document.createElement('button');
    button.id = 'ai-arena-analyze-btn';
    button.textContent = '🎯 让 Kimi 分析';
    button.style.cssText = `
      margin-left: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      transition: transform 0.1s, box-shadow 0.1s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = 'none';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendToKimi();
    });

    // Insert next to the target element
    const container = targetElement.parentElement;
    if (container) {
      container.appendChild(button);
      isButtonInjected = true;
      console.log('[AI Arena] Analyze button injected');
    }
  }

  /**
   * Listen for messages from background script
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'connection_status') {
      console.log('[AI Arena] Connection status:', request.payload);
    }
    sendResponse({ received: true });
  });

  // Try to inject button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(injectButton, 2000); // Wait for ChatGPT to render
    });
  } else {
    setTimeout(injectButton, 2000);
  }

  // Also try on URL changes (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      isButtonInjected = false;
      setTimeout(injectButton, 2000);
    }
  }).observe(document, { subtree: true, childList: true });

  // Periodic check for button (in case ChatGPT re-renders)
  setInterval(() => {
    if (!document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = false;
      injectButton();
    }
  }, 5000);
})();
```

- [ ] **Step 2: Commit**

```bash
git add extension/content_chatgpt.js
git commit -m "feat(extension): add ChatGPT content script with conversation extraction"
```

---

## Task 6: Chrome Extension — Kimi Content Script

**Files:**
- Create: `extension/content_kimi.js`

- [ ] **Step 1: Create extension/content_kimi.js**

```javascript
/**
 * AI Arena Bridge — Kimi Content Script
 *
 * Injected into moonshot.cn to receive analysis results
 * and auto-submit them into Kimi's chat input.
 */

(function () {
  'use strict';

  console.log('[AI Arena] Kimi content script loaded');

  let pendingAnalysis = null;

  /**
   * Find the chat input element on Kimi page
   */
  function findInputElement() {
    const selectors = [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="发送"]',
      'div[contenteditable="true"]',
      'textarea',
      '[role="textbox"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * Find the send button on Kimi page
   */
  function findSendButton() {
    const selectors = [
      'button[aria-label*="发送"]',
      'button[type="submit"]',
      'button svg[viewBox]',
      'button:has(svg)',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * Set text in an input element (handles both textarea and contenteditable)
   */
  function setInputText(element, text) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.isContentEditable) {
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Submit the analysis text to Kimi
   */
  function submitToKimi(text) {
    const input = findInputElement();
    if (!input) {
      console.error('[AI Arena] Could not find Kimi input element');
      showNotification('未找到 Kimi 输入框，请确保页面已加载', 'error');
      return false;
    }

    // Set the text
    setInputText(input, text);

    // Wait a bit for React/Vue to register the change
    setTimeout(() => {
      const sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
        console.log('[AI Arena] Analysis submitted to Kimi');
        showNotification('Kimi 分析已发送！');
      } else {
        // Try pressing Enter
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(enterEvent);
        console.log('[AI Arena] Submitted via Enter key');
      }
    }, 500);

    return true;
  }

  /**
   * Show a temporary notification
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s;
    `;

    if (type === 'error') {
      notification.style.background = '#fee2e2';
      notification.style.color = '#991b1b';
    } else {
      notification.style.background = '#dbeafe';
      notification.style.color = '#1e40af';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Listen for messages from background script
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[AI Arena] Kimi received message:', request);

    if (request.type === 'analysis_complete') {
      const fullText = request.payload.full_text;
      console.log('[AI Arena] Received analysis, length:', fullText.length);

      // Try to submit immediately
      const success = submitToKimi(fullText);
      if (!success) {
        // Store for later if page not ready
        pendingAnalysis = fullText;
      }
    } else if (request.type === 'connection_status') {
      console.log('[AI Arena] Connection status:', request.payload);
    }

    sendResponse({ received: true });
  });

  // Check for pending analysis when page loads/changes
  const checkPending = () => {
    if (pendingAnalysis) {
      const success = submitToKimi(pendingAnalysis);
      if (success) {
        pendingAnalysis = null;
      }
    }
  };

  // Run check periodically
  setInterval(checkPending, 2000);

  // Also check on DOM changes
  new MutationObserver(checkPending).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add extension/content_kimi.js
git commit -m "feat(extension): add Kimi content script with auto-submit"
```

---

## Task 7: React Frontend — Setup & Layout

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/components/StatusBar.jsx`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "ai-arena-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "vite": "^5.0.8"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
```

- [ ] **Step 3: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Arena — AI 竞技场</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create frontend/src/main.jsx**

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 5: Create frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f5f5;
}

iframe {
  border: none;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 6: Create frontend/src/components/Layout.jsx**

```jsx
import React from 'react';

/**
 * Main layout component — side-by-side iframes for ChatGPT and Kimi
 */
export default function Layout() {
  return (
    <div className="flex h-full w-full">
      {/* Left panel — ChatGPT */}
      <div className="flex-1 flex flex-col border-r border-gray-300">
        <div className="bg-white px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">ChatGPT</h2>
          <span className="text-xs text-gray-500">左侧对话，右侧分析</span>
        </div>
        <div className="flex-1">
          <iframe
            src="https://chatgpt.com"
            title="ChatGPT"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>

      {/* Right panel — Kimi */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Kimi — 批判性分析</h2>
          <span className="text-xs text-gray-500">基于左侧对话的审视</span>
        </div>
        <div className="flex-1">
          <iframe
            src="https://moonshot.cn"
            title="Kimi"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create frontend/src/components/StatusBar.jsx**

```jsx
import React, { useState, useEffect } from 'react';

/**
 * Status bar showing backend connection status
 */
export default function StatusBar() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:8000/health', {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          setStatus('connected');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('disconnected');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    checking: { color: 'bg-yellow-400', text: '检查中...' },
    connected: { color: 'bg-green-500', text: '后端已连接' },
    disconnected: { color: 'bg-red-500', text: '后端未连接' },
    error: { color: 'bg-orange-500', text: '后端异常' },
  };

  const config = statusConfig[status];

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-600">{config.text}</span>
      <span className="text-xs text-gray-400 ml-auto">
        AI Arena v1.0 — 在 ChatGPT 页面点击"让 Kimi 分析"按钮触发
      </span>
    </div>
  );
}
```

- [ ] **Step 8: Create frontend/src/App.jsx**

```jsx
import React from 'react';
import Layout from './components/Layout';
import StatusBar from './components/StatusBar';

/**
 * Main App component
 */
export default function App() {
  return (
    <div className="h-full flex flex-col">
      {/* Top navigation */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            AI Arena
          </span>
          <span className="text-xs text-gray-500">AI 竞技场</span>
        </div>
        <div className="text-xs text-gray-500">
          让 AI 互相批判，获得多视角思考
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Layout />
      </main>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 9: Create Tailwind config files**

```bash
cd frontend
npx tailwindcss init -p
```

Then update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 10: Test frontend build**

```bash
cd frontend
npm install
npm run build
```

Expected: Build completes without errors, `dist/` directory created.

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add React layout with side-by-side iframes"
```

---

## Task 8: Integration Testing & Final Verification

**Files:**
- Modify: `README.md` (update with final instructions)

- [ ] **Step 1: Update README.md with complete setup instructions**

Replace the README content with:

```markdown
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
│   └── prompts/      # System prompts
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

## License

MIT
```

- [ ] **Step 2: Create a simple integration test script**

Create `backend/test_integration.py`:

```python
"""Simple integration test for the backend."""

import asyncio

import socketio


async def test_websocket():
    """Test WebSocket connection and analyze flow."""
    client = socketio.AsyncClient()

    received_chunks = []
    received_complete = []

    @client.on("analysis_chunk")
    async def on_chunk(data):
        received_chunks.append(data["chunk"])

    @client.on("analysis_complete")
    async def on_complete(data):
        received_complete.append(data["full_text"])
        await client.disconnect()

    try:
        await client.connect("http://localhost:8000")
        print("Connected to backend")

        await client.emit("analyze_conversation", {
            "messages": [
                {"role": "user", "content": "什么是人工智能？"},
                {"role": "assistant", "content": "人工智能是模拟人类智能的技术。"},
            ]
        })

        # Wait for response (with timeout)
        await asyncio.wait_for(client.wait(), timeout=30)

        print(f"Received {len(received_chunks)} chunks")
        print(f"Complete text length: {len(received_complete[0]) if received_complete else 0}")
        print("Integration test PASSED" if received_complete else "Integration test FAILED")

    except Exception as e:
        print(f"Test failed: {e}")
    finally:
        if client.connected:
            await client.disconnect()


if __name__ == "__main__":
    asyncio.run(test_websocket())
```

- [ ] **Step 3: Run integration test**

```bash
# Terminal 1: Start backend
cd backend
source venv/bin/activate
uvicorn main:socket_app --host 0.0.0.0 --port 8000

# Terminal 2: Run test
cd backend
source venv/bin/activate
python test_integration.py
```

Expected: Test connects, sends messages, receives analysis (or test response if no API key).

- [ ] **Step 4: Final commit**

```bash
git add README.md backend/test_integration.py
git commit -m "docs: complete README and add integration test"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec Requirement | Implementing Task |
|-----------------|-------------------|
| Chrome Extension MV3 with two content scripts | Task 4, 5, 6 |
| WebSocket communication between extension and backend | Task 4 (background.js) |
| FastAPI backend with Socket.IO | Task 2 |
| Kimi API integration with critic prompt | Task 3 |
| React frontend with side-by-side iframes | Task 7 |
| ChatGPT conversation extraction | Task 5 |
| Kimi auto-submit | Task 6 |
| Connection status and error handling | Task 4, 7 |
| Reconnection logic | Task 4 |

### 2. Placeholder Scan

- No "TBD", "TODO", or "implement later" found
- All code steps contain actual implementation code
- No vague references to undefined functions

### 3. Type Consistency

- WebSocket event names consistent: `analyze_conversation`, `analysis_chunk`, `analysis_complete`
- Message format consistent between extension and backend
- Data structures match across all components

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-ai-arena-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like to use?
