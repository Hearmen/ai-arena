# AI Arena V2 — 设计文档

**日期**: 2026-04-30  
**版本**: v2.0  
**状态**: 已确认

---

## 1. 产品概述

**AI Arena** 是一个浏览器扩展，帮助用户在 ChatGPT 对话时获得 Kimi 的批判性分析。

### 核心场景

1. **展开面板**：用户点击扩展浮动按钮 🎯，在 ChatGPT 页面右侧展开 Kimi 分析面板；同时 ChatGPT 输入区域被注入"让 Kimi 分析"按钮
2. **正常对话**：用户在 ChatGPT 网页版正常对话
3. **手动触发**：ChatGPT 给出回复后，用户点击"让 Kimi 分析"按钮（如果面板处于折叠状态，自动展开）
4. **抓取对话**：扩展抓取**完整对话历史**（从第一轮到当前所有消息）
5. **后端处理**：对话数据发给后端 → 包装成批判性 prompt
6. **自动发送**：Kimi 面板自动填入 prompt 并发送
7. **查看结果**：用户在右侧 Kimi 面板中看到批判性分析

### 关键设计决策

| 决策 | 选择 | 说明 |
|------|------|------|
| 触发时机 | 每轮手动触发 | 用户掌控分析节奏，避免干扰连续对话 |
| 面板状态 | 分析时自动展开 | 如果折叠，点击分析按钮自动展开面板 |
| 分析范围 | 完整对话历史 | 从第一轮到当前全部消息，Kimi 有完整上下文 |
| 目标平台 | ChatGPT + Kimi | MVP 先支持这两个，架构预留扩展能力 |

---

## 2. 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                     浏览器标签页 (chatgpt.com)                  │
│                                                              │
│   ┌──────────────────────────────┐  ┌─────────────────────┐ │
│   │                              │  │  Kimi 分析面板       │ │
│   │  ChatGPT 正常对话             │  │  (iframe kimi.com)   │ │
│   │                              │  │                     │ │
│   │  用户: 什么是AI?              │  │  [🎯 让 Kimi 分析]   │ │
│   │                              │  │                     │ │
│   │  ChatGPT: AI是模拟人类...     │  │  Kimi: 从批判性思维  │ │
│   │                              │  │  来看，这个观点...   │ │
│   │                              │  │                     │ │
│   └──────────────────────────────┘  │  [可拖拽/折叠]       │ │
│                                     └─────────────────────┘ │
│   ↑ content_chatgpt.js (注入)        ↑ content_kimi.js (注入)│
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  浮动按钮 [🎯] — 点击展开/折叠 Kimi 面板              │  │
│   └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ Socket.IO
                              │
                    ┌─────────┴─────────┐
                    │  Python/FastAPI   │
                    │    本地后端        │
                    │  (包装 prompt)     │
                    └───────────────────┘
```

---

## 3. 组件设计

### 3.1 扩展架构（可扩展设计）

```
extension/
├── manifest.json              # 扩展配置
├── background.js              # Service Worker — 连接后端
├── core/
│   ├── adapter-base.js        # 适配器基类
│   ├── chatgpt-adapter.js     # ChatGPT 页面适配器
│   └── kimi-adapter.js        # Kimi 页面适配器
├── ui/
│   ├── panel.js               # 侧边栏面板管理
│   ├── floating-button.js     # 浮动按钮
│   └── styles.css             # 面板样式
├── api/
│   └── backend-client.js      # 后端通信封装
└── lib/
    └── socket.io.min.js       # Socket.IO 客户端
```

### 3.2 Adapter 设计模式

每个 AI 平台需要独立的 Adapter：

```javascript
// adapter-base.js
class BaseAdapter {
  constructor() {
    this.platform = 'unknown';
  }

  // 检测当前页面是否匹配
  static match() {
    return false;
  }

  // 提取对话历史
  extractConversation() {
    throw new Error('Not implemented');
  }

  // 注入 UI 元素
  injectUI() {
    throw new Error('Not implemented');
  }

  // 获取页面标题
  getPageTitle() {
    return document.title;
  }
}

// chatgpt-adapter.js
class ChatGPTAdapter extends BaseAdapter {
  static match() {
    return location.hostname === 'chatgpt.com';
  }

  extractConversation() {
    // ChatGPT 特定的 DOM 选择器
    const messages = [];
    const articles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
    // ... 提取逻辑
    return messages;
  }

  injectUI() {
    // 在 ChatGPT 页面注入浮动按钮和侧边栏
    injectFloatingButton();
    injectSidePanel();
  }
}

// kimi-adapter.js
class KimiAdapter extends BaseAdapter {
  static match() {
    return location.hostname === 'kimi.com' || location.hostname === 'www.kimi.com';
  }

  extractConversation() {
    // Kimi 特定的 DOM 选择器
    // ...
  }

  injectUI() {
    // Kimi 页面可能不需要注入按钮，只需要接收 prompt
  }

  // 填入 prompt 并发送
  async submitPrompt(prompt) {
    // 找到输入框，填入文本，点击发送
  }
}
```

### 3.3 侧边栏面板设计

```javascript
// panel.js
class SidePanel {
  constructor() {
    this.isOpen = false;
    this.width = 400;
    this.iframe = null;
    this.container = null;
  }

  create() {
    // 创建面板容器
    this.container = document.createElement('div');
    this.container.id = 'ai-arena-panel';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: ${this.width}px;
      height: 100vh;
      background: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 16px rgba(0,0,0,0.1);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      transition: transform 0.3s ease;
      transform: translateX(100%); /* 默认隐藏 */
    `;

    // 创建标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9fafb;
    `;
    header.innerHTML = `
      <span style="font-weight: 600; font-size: 14px;">🎯 Kimi 批判性分析</span>
      <button id="ai-arena-close" style="background: none; border: none; cursor: pointer; font-size: 18px;">×</button>
    `;

    // 创建 iframe 加载 Kimi
    this.iframe = document.createElement('iframe');
    this.iframe.src = 'https://www.kimi.com';
    this.iframe.style.cssText = `
      flex: 1;
      border: none;
      width: 100%;
    `;

    // 创建操作栏
    const actionBar = document.createElement('div');
    actionBar.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    `;
    actionBar.innerHTML = `
      <button id="ai-arena-analyze" style="
        width: 100%;
        padding: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        font-weight: 500;
      ">🎯 让 Kimi 分析当前对话</button>
    `;

    this.container.appendChild(header);
    this.container.appendChild(this.iframe);
    this.container.appendChild(actionBar);
    document.body.appendChild(this.container);

    // 绑定事件
    this.bindEvents();
  }

  open() {
    this.container.style.transform = 'translateX(0)';
    this.isOpen = true;
  }

  close() {
    this.container.style.transform = 'translateX(100%)';
    this.isOpen = false;
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }
}
```

### 3.4 浮动按钮设计

```javascript
// floating-button.js
class FloatingButton {
  constructor(onClick) {
    this.button = null;
    this.onClick = onClick;
  }

  create() {
    this.button = document.createElement('button');
    this.button.id = 'ai-arena-float-btn';
    this.button.textContent = '🎯';
    this.button.title = 'AI Arena — 打开 Kimi 分析面板';
    this.button.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      z-index: 999998;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    this.button.addEventListener('mouseenter', () => {
      this.button.style.transform = 'scale(1.1)';
      this.button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
    });

    this.button.addEventListener('mouseleave', () => {
      this.button.style.transform = 'scale(1)';
      this.button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    this.button.addEventListener('click', () => {
      this.onClick();
    });

    document.body.appendChild(this.button);
  }
}
```

---

## 4. 数据流

```
用户在 ChatGPT 聊天
        ↓
点击浮动按钮 🎯 → 展开右侧 Kimi 面板
        ↓
点击"让 Kimi 分析"
        ↓
content_chatgpt.js 提取对话历史
        ↓
chrome.runtime.sendMessage → background.js
        ↓
Socket.IO → 后端
        ↓
后端包装 prompt
        ↓
Socket.IO → background.js
        ↓
chrome.tabs.sendMessage → content_kimi.js (在 iframe 中)
        ↓
content_kimi.js 填入输入框 → 点击发送
        ↓
Kimi 生成批判性分析（显示在右侧面板）
```

---

## 5. 扩展可扩展性设计

### 5.1 新增 AI 平台适配器

要支持新的 AI 平台（如 Claude、Gemini），只需：

1. 创建新的 Adapter 类继承 `BaseAdapter`
2. 实现 `match()`、`extractConversation()`、`injectUI()` 方法
3. 在 manifest.json 中添加 content_scripts 匹配规则
4. 在入口文件中注册 Adapter

```javascript
// 入口文件
const adapters = [
  ChatGPTAdapter,
  KimiAdapter,
  // ClaudeAdapter,  // 未来扩展
  // GeminiAdapter,  // 未来扩展
];

const currentAdapter = adapters.find(Adapter => Adapter.match());
if (currentAdapter) {
  const adapter = new currentAdapter();
  adapter.injectUI();
}
```

### 5.2 配置化设计

```javascript
// config.js
const AI_ARENA_CONFIG = {
  // 支持的 AI 平台
  platforms: {
    chatgpt: {
      name: 'ChatGPT',
      hostname: 'chatgpt.com',
      adapter: 'ChatGPTAdapter',
    },
    kimi: {
      name: 'Kimi',
      hostname: 'kimi.com',
      adapter: 'KimiAdapter',
    },
  },

  // 面板配置
  panel: {
    defaultWidth: 400,
    minWidth: 300,
    maxWidth: 600,
  },

  // 后端配置
  backend: {
    url: 'http://localhost:8000',
  },
};
```

---

## 6. 后端设计

后端保持简单，只做 prompt 包装：

```python
# main.py (保持不变)
# - Socket.IO 服务端
# - 接收对话数据
# - 包装成批判性 prompt
# - 返回给扩展
```

---

## 7. 文件结构

```
ai-arena/
├── backend/                  # Python/FastAPI 后端（不变）
│   ├── main.py
│   ├── requirements.txt
│   └── utils/
│
├── extension/                # Chrome 扩展（重构）
│   ├── manifest.json
│   ├── background.js         # Service Worker
│   ├── lib/
│   │   └── socket.io.min.js
│   ├── core/
│   │   ├── adapter-base.js
│   │   ├── chatgpt-adapter.js
│   │   └── kimi-adapter.js
│   ├── ui/
│   │   ├── panel.js
│   │   ├── floating-button.js
│   │   └── styles.css
│   ├── api/
│   │   └── backend-client.js
│   └── popup.html/js         # 扩展设置弹窗
│
├── frontend/                 # 可选：独立控制面板页面
│   └── ...
│
└── docs/
    └── 2026-04-30-ai-arena-v2-design.md
```

---

## 8. 成功标准

- [ ] 在 ChatGPT 页面显示浮动按钮 🎯
- [ ] 点击按钮展开右侧 Kimi 面板
- [ ] Kimi 面板内 iframe 正常加载 kimi.com
- [ ] 点击"让 Kimi 分析"抓取 ChatGPT 对话
- [ ] 后端正确包装 prompt
- [ ] Kimi 面板自动填入 prompt 并发送
- [ ] Kimi 显示批判性分析结果
- [ ] 面板可拖拽调整宽度
- [ ] 面板可折叠/展开
- [ ] Adapter 架构可扩展新平台
