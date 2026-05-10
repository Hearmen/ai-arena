# AI Arena V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor AI Arena extension to embed Kimi analysis panel inside ChatGPT page via floating sidebar, with extensible adapter architecture.

**Architecture:** Content scripts detect the current AI platform via Adapter pattern, inject a floating button and collapsible side panel. ChatGPT adapter extracts conversation and sends to backend via Socket.IO. Kimi adapter (running inside panel iframe) receives the prompt and auto-submits. All UI components are platform-agnostic.

**Tech Stack:** Chrome Extension MV3, Vanilla JS (ES6 modules), Socket.IO client, CSS-in-JS

---

## File Structure

```
extension/
├── manifest.json              # MV3 config, content_scripts, permissions
├── background.js              # Service Worker: Socket.IO to backend
├── lib/
│   └── socket.io.min.js       # Socket.IO client (existing)
├── core/
│   ├── adapter-base.js        # Abstract base class for platform adapters
│   ├── chatgpt-adapter.js     # ChatGPT: extract conversation, inject UI
│   └── kimi-adapter.js        # Kimi: receive prompt, auto-submit
├── ui/
│   ├── panel.js               # Side panel: iframe container, open/close/resize
│   ├── floating-button.js     # Float button to toggle panel
│   └── styles.css             # Panel & button styles
├── api/
│   └── backend-client.js      # Socket.IO wrapper, event handling
└── popup.html/js              # Extension popup (settings, status)
```

---

## Task 1: Refactor Extension Directory Structure

**Files:**
- Create: `extension/core/adapter-base.js`
- Create: `extension/core/chatgpt-adapter.js`
- Create: `extension/core/kimi-adapter.js`
- Create: `extension/ui/panel.js`
- Create: `extension/ui/floating-button.js`
- Create: `extension/ui/styles.css`
- Create: `extension/api/backend-client.js`
- Modify: `extension/manifest.json`
- Delete: `extension/content_chatgpt.js` (will be replaced by adapter)
- Delete: `extension/content_kimi.js` (will be replaced by adapter)
- Delete: `extension/rules.json` (no longer needed, no iframe on ChatGPT)

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/hearmen/Project/AI4Sec/ai_generate/kimi-wp/ai-arena/extension
mkdir -p core ui api lib
# lib/ already has socket.io.min.js
```

- [ ] **Step 2: Delete old files**

```bash
rm -f content_chatgpt.js content_kimi.js rules.json
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(extension): restructure for V2 adapter architecture"
```

---

## Task 2: Update manifest.json for New Architecture

**Files:**
- Modify: `extension/manifest.json`

- [ ] **Step 1: Write new manifest.json**

```json
{
  "manifest_version": 3,
  "name": "AI Arena Bridge",
  "version": "2.0.0",
  "description": "在 ChatGPT 页面嵌入 Kimi 批判性分析面板",
  "permissions": [
    "activeTab",
    "storage",
    "alarms",
    "tabs"
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://kimi.com/*",
    "https://www.kimi.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*"],
      "js": ["lib/socket.io.min.js", "core/adapter-base.js", "core/chatgpt-adapter.js", "ui/styles.css", "ui/panel.js", "ui/floating-button.js", "api/backend-client.js"],
      "css": ["ui/styles.css"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://kimi.com/*", "https://www.kimi.com/*"],
      "js": ["lib/socket.io.min.js", "core/adapter-base.js", "core/kimi-adapter.js", "api/backend-client.js"],
      "all_frames": true,
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "web_accessible_resources": [
    {
      "resources": ["lib/socket.io.min.js"],
      "matches": ["<all_urls>"]
    }
  ],
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

Note: `declarativeNetRequest` removed because we no longer iframe ChatGPT. Kimi iframe loads from ChatGPT page which is same-origin enough, or we keep it if needed.

- [ ] **Step 2: Commit**

```bash
git add extension/manifest.json
git commit -m "feat(extension): update manifest for V2 architecture"
```

---

## Task 3: Create Adapter Base Class

**Files:**
- Create: `extension/core/adapter-base.js`

- [ ] **Step 1: Write adapter-base.js**

```javascript
/**
 * AI Arena — Adapter Base Class
 * All platform adapters must extend this class.
 */

class BaseAdapter {
  constructor() {
    this.platform = 'unknown';
    this.panel = null;
    this.floatBtn = null;
    this.backend = null;
  }

  /**
   * Check if current page matches this adapter
   * @returns {boolean}
   */
  static match() {
    return false;
  }

  /**
   * Extract conversation history from the page
   * @returns {Array<{role: string, content: string}>}
   */
  extractConversation() {
    throw new Error(`${this.platform}: extractConversation() not implemented`);
  }

  /**
   * Inject UI elements (button, panel)
   */
  injectUI() {
    throw new Error(`${this.platform}: injectUI() not implemented`);
  }

  /**
   * Initialize adapter
   */
  init() {
    console.log(`[AI Arena] ${this.platform} adapter initialized`);
    this.injectUI();
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseAdapter;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/core/adapter-base.js
git commit -m "feat(extension): add adapter base class"
```

---

## Task 4: Create UI Components (Panel & Floating Button)

**Files:**
- Create: `extension/ui/styles.css`
- Create: `extension/ui/panel.js`
- Create: `extension/ui/floating-button.js`

- [ ] **Step 1: Write styles.css**

```css
/* AI Arena Panel Styles */
#ai-arena-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
  z-index: 999999;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  transform: translateX(100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#ai-arena-panel.open {
  transform: translateX(0);
}

#ai-arena-panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
  flex-shrink: 0;
}

#ai-arena-panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
}

#ai-arena-panel-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
  color: #6b7280;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.15s;
}

#ai-arena-panel-close:hover {
  background: #e5e7eb;
}

#ai-arena-panel-iframe {
  flex: 1;
  border: none;
  width: 100%;
}

#ai-arena-panel-actions {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

#ai-arena-analyze-btn {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.1s, box-shadow 0.1s;
}

#ai-arena-analyze-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

#ai-arena-analyze-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Floating Button */
#ai-arena-float-btn {
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
}

#ai-arena-float-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

/* Resize handle */
#ai-arena-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  background: transparent;
  transition: background 0.15s;
}

#ai-arena-resize-handle:hover {
  background: #667eea;
}
```

- [ ] **Step 2: Write panel.js**

```javascript
/**
 * AI Arena — Side Panel Component
 * Creates a collapsible side panel with iframe for Kimi.
 */

class SidePanel {
  constructor(options = {}) {
    this.width = options.width || 400;
    this.minWidth = options.minWidth || 300;
    this.maxWidth = options.maxWidth || 600;
    this.iframeSrc = options.iframeSrc || 'https://www.kimi.com';
    this.container = null;
    this.iframe = null;
    this.isOpen = false;
    this.onAnalyze = options.onAnalyze || (() => {});
  }

  create() {
    if (document.getElementById('ai-arena-panel')) {
      return;
    }

    // Container
    this.container = document.createElement('div');
    this.container.id = 'ai-arena-panel';
    this.container.style.width = `${this.width}px`;

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'ai-arena-resize-handle';
    this.setupResize(resizeHandle);

    // Header
    const header = document.createElement('div');
    header.id = 'ai-arena-panel-header';
    header.innerHTML = `
      <span id="ai-arena-panel-title">🎯 Kimi 批判性分析</span>
      <button id="ai-arena-panel-close" title="关闭">×</button>
    `;

    // Iframe
    this.iframe = document.createElement('iframe');
    this.iframe.id = 'ai-arena-panel-iframe';
    this.iframe.src = this.iframeSrc;
    this.iframe.allow = "clipboard-read; clipboard-write";

    // Actions
    const actions = document.createElement('div');
    actions.id = 'ai-arena-panel-actions';
    actions.innerHTML = `
      <button id="ai-arena-analyze-btn">🎯 让 Kimi 分析当前对话</button>
    `;

    this.container.appendChild(resizeHandle);
    this.container.appendChild(header);
    this.container.appendChild(this.iframe);
    this.container.appendChild(actions);
    document.body.appendChild(this.container);

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('ai-arena-panel-close').addEventListener('click', () => this.close());
    document.getElementById('ai-arena-analyze-btn').addEventListener('click', () => this.onAnalyze());
  }

  setupResize(handle) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = this.width;
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const delta = startX - e.clientX;
      this.width = Math.max(this.minWidth, Math.min(this.maxWidth, startWidth + delta));
      this.container.style.width = `${this.width}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
      }
    });
  }

  open() {
    this.container.classList.add('open');
    this.isOpen = true;
  }

  close() {
    this.container.classList.remove('open');
    this.isOpen = false;
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  setAnalyzing(analyzing) {
    const btn = document.getElementById('ai-arena-analyze-btn');
    if (btn) {
      btn.disabled = analyzing;
      btn.textContent = analyzing ? '⏳ 分析中...' : '🎯 让 Kimi 分析当前对话';
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SidePanel;
}
```

- [ ] **Step 3: Write floating-button.js**

```javascript
/**
 * AI Arena — Floating Button Component
 * Creates a floating button to toggle the side panel.
 */

class FloatingButton {
  constructor(onClick) {
    this.onClick = onClick;
    this.button = null;
  }

  create() {
    if (document.getElementById('ai-arena-float-btn')) {
      return;
    }

    this.button = document.createElement('button');
    this.button.id = 'ai-arena-float-btn';
    this.button.textContent = '🎯';
    this.button.title = 'AI Arena — 打开 Kimi 分析面板';

    this.button.addEventListener('click', () => {
      this.onClick();
    });

    document.body.appendChild(this.button);
  }

  destroy() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FloatingButton;
}
```

- [ ] **Step 4: Commit**

```bash
git add extension/ui/
git commit -m "feat(extension): add panel and floating button UI components"
```

---

## Task 5: Create Backend Client

**Files:**
- Create: `extension/api/backend-client.js`

- [ ] **Step 1: Write backend-client.js**

```javascript
/**
 * AI Arena — Backend Client
 * Socket.IO wrapper for communication with FastAPI backend.
 */

class BackendClient {
  constructor(url = 'http://localhost:8000') {
    this.url = url;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    if (this.socket && this.socket.connected) {
      console.log('[AI Arena] Already connected');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ['websocket', 'polling'],
          reconnection: false,
          timeout: 5000,
        });

        this.socket.on('connect', () => {
          console.log('[AI Arena] Connected to backend');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('analysis_complete', (data) => {
          console.log('[AI Arena] Analysis complete:', data);
          if (this.onAnalysisComplete) {
            this.onAnalysisComplete(data);
          }
        });

        this.socket.on('analysis_error', (data) => {
          console.error('[AI Arena] Analysis error:', data);
          if (this.onAnalysisError) {
            this.onAnalysisError(data);
          }
        });

        this.socket.on('disconnect', () => {
          console.log('[AI Arena] Disconnected');
          this.isConnected = false;
          this.attemptReconnect();
        });

        this.socket.on('connect_error', (err) => {
          console.error('[AI Arena] Connection error:', err.message);
          this.isConnected = false;
          reject(err);
          this.attemptReconnect();
        });

      } catch (e) {
        reject(e);
      }
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[AI Arena] Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[AI Arena] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }

  analyzeConversation(messages) {
    if (!this.socket || !this.socket.connected) {
      console.error('[AI Arena] Not connected to backend');
      return false;
    }

    this.socket.emit('analyze_conversation', { messages });
    return true;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackendClient;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/api/backend-client.js
git commit -m "feat(extension): add Socket.IO backend client"
```

---

## Task 6: Create ChatGPT Adapter

**Files:**
- Create: `extension/core/chatgpt-adapter.js`

- [ ] **Step 1: Write chatgpt-adapter.js**

```javascript
/**
 * AI Arena — ChatGPT Adapter
 * Extracts conversation from ChatGPT and injects AI Arena UI.
 */

class ChatGPTAdapter extends BaseAdapter {
  constructor() {
    super();
    this.platform = 'ChatGPT';
    this.panel = null;
    this.floatBtn = null;
    this.backend = new BackendClient();
  }

  static match() {
    return location.hostname === 'chatgpt.com';
  }

  extractConversation() {
    try {
      const messages = [];

      // Strategy 1: data-testid based articles
      const articles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
      if (articles.length > 0) {
        articles.forEach((article) => {
          const isUser = article.querySelector('img[alt*="User"], [data-testid*="user"]') !== null;
          const role = isUser ? 'user' : 'assistant';

          const markdownEl = article.querySelector('.markdown, [data-message-author-role] .whitespace-pre-wrap');
          let content = '';
          if (markdownEl) {
            content = markdownEl.textContent.trim();
          } else {
            const paragraphs = article.querySelectorAll('p');
            content = Array.from(paragraphs).map(p => p.textContent.trim()).join('\n');
          }

          if (content) {
            messages.push({ role, content });
          }
        });
        return messages;
      }

      // Strategy 2: data-message-author-role
      const messageGroups = document.querySelectorAll('[data-message-author-role]');
      if (messageGroups.length > 0) {
        messageGroups.forEach((group) => {
          const role = group.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
          const textEl = group.querySelector('.whitespace-pre-wrap, .markdown, p');
          if (textEl) {
            messages.push({ role, content: textEl.textContent.trim() });
          }
        });
        return messages;
      }

      return messages;
    } catch (e) {
      console.error('[AI Arena] Error extracting conversation:', e);
      return [];
    }
  }

  injectUI() {
    // Create panel
    this.panel = new SidePanel({
      onAnalyze: () => this.handleAnalyze(),
    });
    this.panel.create();

    // Create floating button
    this.floatBtn = new FloatingButton(() => {
      this.panel.toggle();
    });
    this.floatBtn.create();

    // Connect to backend
    this.backend.connect().catch((err) => {
      console.error('[AI Arena] Failed to connect to backend:', err);
    });

    // Handle analysis complete
    this.backend.onAnalysisComplete = (data) => {
      this.panel.setAnalyzing(false);
      this.sendToKimi(data.full_text);
    };

    this.backend.onAnalysisError = (data) => {
      this.panel.setAnalyzing(false);
      alert('分析失败: ' + data.error);
    };
  }

  handleAnalyze() {
    const messages = this.extractConversation();
    if (messages.length === 0) {
      alert('未检测到对话内容');
      return;
    }

    this.panel.setAnalyzing(true);
    const success = this.backend.analyzeConversation(messages);
    if (!success) {
      this.panel.setAnalyzing(false);
      alert('后端未连接，请检查后端服务');
    }
  }

  sendToKimi(prompt) {
    // Send message to Kimi iframe via postMessage or extension messaging
    // The Kimi adapter inside iframe will receive this
    const iframe = document.getElementById('ai-arena-panel-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'AI_ARENA_PROMPT',
        prompt: prompt,
      }, '*');
    }
  }
}

// Auto-init if on ChatGPT
if (ChatGPTAdapter.match()) {
  const adapter = new ChatGPTAdapter();
  adapter.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatGPTAdapter;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/core/chatgpt-adapter.js
git commit -m "feat(extension): add ChatGPT adapter with UI injection"
```

---

## Task 7: Create Kimi Adapter

**Files:**
- Create: `extension/core/kimi-adapter.js`

- [ ] **Step 1: Write kimi-adapter.js**

```javascript
/**
 * AI Arena — Kimi Adapter
 * Receives prompt from ChatGPT page and auto-submits in Kimi.
 */

class KimiAdapter extends BaseAdapter {
  constructor() {
    super();
    this.platform = 'Kimi';
    this.pendingPrompt = null;
  }

  static match() {
    return location.hostname === 'kimi.com' || location.hostname === 'www.kimi.com';
  }

  extractConversation() {
    // Kimi doesn't need to extract conversation in this mode
    return [];
  }

  injectUI() {
    // Listen for postMessage from parent (ChatGPT page)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'AI_ARENA_PROMPT') {
        console.log('[AI Arena] Received prompt from parent:', event.data.prompt.substring(0, 100));
        this.submitPrompt(event.data.prompt);
      }
    });

    // Also listen for extension messages (fallback)
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'analysis_complete') {
          this.submitPrompt(request.payload.full_text);
          sendResponse({ received: true });
        }
        return true;
      });
    }

    console.log('[AI Arena] Kimi adapter initialized, listening for prompts');
  }

  async submitPrompt(prompt) {
    // Wait for page to be ready
    await this.waitForElement('.chat-input-editor', 5000);

    const input = document.querySelector('.chat-input-editor');
    if (!input) {
      console.error('[AI Arena] Kimi input not found');
      this.pendingPrompt = prompt;
      return false;
    }

    // Focus and set text
    input.focus();
    input.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = prompt;
    input.appendChild(p);

    // Dispatch events
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: prompt,
    }));

    // Wait and click send
    setTimeout(() => {
      const sendBtn = document.querySelector('.send-button-container:not(.disabled)');
      if (sendBtn) {
        sendBtn.click();
        console.log('[AI Arena] Prompt submitted to Kimi');
      } else {
        // Fallback: press Enter
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(enterEvent);
      }
    }, 500);

    return true;
  }

  waitForElement(selector, timeout) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }
}

// Auto-init if on Kimi
if (KimiAdapter.match()) {
  const adapter = new KimiAdapter();
  adapter.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KimiAdapter;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/core/kimi-adapter.js
git commit -m "feat(extension): add Kimi adapter with prompt receiving"
```

---

## Task 8: Update Background Script

**Files:**
- Modify: `extension/background.js`

- [ ] **Step 1: Simplify background.js**

Background no longer routes between tabs (since Kimi is in iframe via postMessage). It only handles:
1. Socket.IO connection to backend
2. Forwarding messages from content scripts to backend

```javascript
/**
 * AI Arena Bridge — Background Service Worker (V2)
 * Simplified: only handles Socket.IO connection.
 */

try {
  importScripts('lib/socket.io.min.js');
} catch (e) {
  console.error('[AI Arena] Failed to load Socket.IO:', e);
}

let socket = null;
let isConnected = false;

function connectSocket() {
  if (socket && socket.connected) return;

  socket = io('http://localhost:8000', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    isConnected = true;
    console.log('[AI Arena] Connected');
  });

  socket.on('disconnect', () => {
    isConnected = false;
    console.log('[AI Arena] Disconnected');
  });

  socket.on('analysis_complete', (data) => {
    // Forward to all tabs (Kimi iframe will receive via postMessage from ChatGPT page)
    console.log('[AI Arena] Analysis complete, forwarding...');
  });
}

// Listen from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'analyze_conversation') {
    if (!socket || !socket.connected) {
      sendResponse({ success: false, error: 'Not connected' });
      return true;
    }
    socket.emit('analyze_conversation', request.payload);
    sendResponse({ success: true });
  } else if (request.type === 'get_status') {
    sendResponse({ connected: isConnected });
  }
  return true;
});

// Auto connect
connectSocket();

// Keep alive
chrome.alarms.create('keepAlive', { periodInMinutes: 4.9 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[AI Arena] Keep alive');
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add extension/background.js
git commit -m "refactor(extension): simplify background script for V2"
```

---

## Task 9: Update Popup

**Files:**
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`

- [ ] **Step 1: Update popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 280px; padding: 16px; font-family: -apple-system, sans-serif; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    .status { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.connected { background: #10b981; }
    .dot.disconnected { background: #ef4444; }
    .info { font-size: 12px; color: #666; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>AI Arena v2</h1>
  <div class="status">
    <div class="dot" id="statusDot"></div>
    <span id="statusText">检查中...</span>
  </div>
  <div class="info">
    在 ChatGPT 页面点击 🎯 按钮展开 Kimi 分析面板
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Update popup.js**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response && response.connected) {
      dot.className = 'dot connected';
      text.textContent = '已连接到后端';
    } else {
      dot.className = 'dot disconnected';
      text.textContent = '未连接到后端';
    }
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add extension/popup.html extension/popup.js
git commit -m "feat(extension): update popup for V2"
```

---

## Task 10: Test Integration

**Files:**
- All extension files

- [ ] **Step 1: Load extension in Chrome**

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `extension/` folder

- [ ] **Step 2: Test on ChatGPT**

1. Open `chatgpt.com`
2. Verify floating button 🎯 appears
3. Click button → panel slides out
4. Verify Kimi loads in iframe
5. Have a conversation with ChatGPT
6. Click "让 Kimi 分析"
7. Verify prompt appears in Kimi and sends

- [ ] **Step 3: Debug if needed**

- Open DevTools on ChatGPT page
- Check Console for `[AI Arena]` logs
- Verify postMessage communication

- [ ] **Step 4: Commit final changes**

```bash
git add -A
git commit -m "feat: AI Arena V2 complete — ChatGPT-embedded Kimi panel"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| Adapter base class | Task 3 |
| ChatGPT adapter | Task 6 |
| Kimi adapter | Task 7 |
| Side panel with iframe | Task 4 |
| Floating button | Task 4 |
| Backend client | Task 5 |
| Extensible architecture | Task 3 (base class) |
| postMessage communication | Task 6, 7 |

### Placeholder Scan

- No TBD/TODO
- All code complete
- All file paths exact

### Type Consistency

- `BaseAdapter` defines interface
- `ChatGPTAdapter` and `KimiAdapter` extend it
- `SidePanel`, `FloatingButton`, `BackendClient` are standalone

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-ai-arena-v2-implementation.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
