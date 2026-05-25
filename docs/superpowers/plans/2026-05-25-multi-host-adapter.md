# AI Arena 多 Host 平台适配实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Arena 扩展新增 Gemini、Kimi、Doubao 作为 Host 平台，使扩展能在这些页面注入按钮、提取对话并发送给 Panel。

**Architecture:** 遵循现有 `host/chatgpt.js` 的适配器模式，为每个新平台创建独立的 Host 适配器文件。更新 Registry 注册新平台，更新 Manifest 配置 content_scripts。各平台采用多选择器降级策略提取 DOM。

**Tech Stack:** Chrome Extension MV3, Vanilla JavaScript, DOM manipulation

---

## File Structure

```
extension/
├── manifest.json                    # 修改：新增 content_scripts 和 host_permissions
├── shared/
│   └── registry.js                  # 修改：新增 platforms 注册
├── host/
│   ├── chatgpt.js                   # 已有（参考模板）
│   ├── gemini.js                    # 新增：Gemini Host 适配器
│   ├── kimi_host.js                 # 新增：Kimi Host 适配器
│   └── doubao_host.js               # 新增：Doubao Host 适配器
├── panel/
│   ├── kimi.js                      # 已有（Panel 脚本，不变）
│   └── doubao.js                    # 已有（Panel 脚本，不变）
```

---

### Task 1: 更新 Registry 注册新平台

**Files:**
- Modify: `extension/shared/registry.js:14-20`

- [ ] **Step 1: 在 platforms 中添加 Gemini、Kimi、Doubao**

```javascript
    platforms: {
      chatgpt: {
        name: 'ChatGPT',
        matches: ['https://chatgpt.com/*'],
      },
      gemini: {
        name: 'Gemini',
        matches: ['https://gemini.google.com/*'],
      },
      kimi: {
        name: 'Kimi',
        matches: ['https://kimi.com/*', 'https://www.kimi.com/*'],
      },
      doubao: {
        name: '豆包',
        matches: ['https://www.doubao.com/*'],
      },
    },
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hearmen/Project/AI4Sec/ai_generate/kimi-wp/ai-arena
git add extension/shared/registry.js
git commit -m "feat(registry): register gemini, kimi, doubao as host platforms"
```

---

### Task 2: 更新 Manifest 配置

**Files:**
- Modify: `extension/manifest.json:10-41`

- [ ] **Step 1: 在 host_permissions 中添加 gemini.google.com**

将第 10-15 行改为：
```json
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://gemini.google.com/*",
    "https://kimi.com/*",
    "https://www.kimi.com/*",
    "https://www.doubao.com/*"
  ],
```

- [ ] **Step 2: 在 content_scripts 末尾新增 3 组 Host 配置**

在现有 content_scripts 数组末尾（第 41 行之前）添加：

```json
    {
      "matches": ["https://gemini.google.com/*"],
      "js": [
        "shared/utils.js",
        "shared/registry.js",
        "host/prompt.js",
        "host/_core.js",
        "host/_ui.js",
        "host/gemini.js"
      ],
      "all_frames": true,
      "run_at": "document_idle"
    },
    {
      "matches": ["https://kimi.com/*", "https://www.kimi.com/*"],
      "js": [
        "shared/utils.js",
        "shared/registry.js",
        "host/prompt.js",
        "host/_core.js",
        "host/_ui.js",
        "host/kimi_host.js"
      ],
      "all_frames": true,
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.doubao.com/*"],
      "js": [
        "shared/utils.js",
        "shared/registry.js",
        "host/prompt.js",
        "host/_core.js",
        "host/_ui.js",
        "host/doubao_host.js"
      ],
      "all_frames": true,
      "run_at": "document_idle"
    }
```

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json
git commit -m "feat(manifest): add content_scripts for gemini, kimi, doubao hosts"
```

---

### Task 3: 创建 Gemini Host 适配器

**Files:**
- Create: `extension/host/gemini.js`

- [ ] **Step 1: 创建 gemini.js**

```javascript
/**
 * AI Arena — Gemini Platform Adapter
 *
 * Gemini-specific DOM operations:
 * - Conversation extraction from Gemini DOM
 * - Button injection into Gemini input area
 * - Layout adjustment for Gemini main content
 */
(function () {
  'use strict';

  console.log('[AI Arena] Gemini adapter loading');

  const INJECTION_DELAY_MS = 2000;
  let isButtonInjected = false;
  let geminiMainEl = null;

  // ───────────────────────────────────────────────
  // Conversation Extraction
  // ───────────────────────────────────────────────
  function extractConversation() {
    try {
      const messages = [];

      // Strategy 1: Gemini's message containers (model-response / user-query)
      const modelResponses = document.querySelectorAll('model-response');
      const userQueries = document.querySelectorAll('user-query');
      
      if (modelResponses.length > 0 || userQueries.length > 0) {
        // Get all message elements in document order
        const allMessages = Array.from(document.querySelectorAll('user-query, model-response'));
        allMessages.forEach((el) => {
          const isUser = el.tagName.toLowerCase() === 'user-query';
          const role = isUser ? 'user' : 'assistant';
          const textEl = el.querySelector('.message-content, .response-content, [class*="content"]');
          let content = '';
          if (textEl) {
            content = textEl.textContent.trim();
          } else {
            content = el.textContent.trim();
          }
          if (content) messages.push({ role, content });
        });
        return messages;
      }

      // Strategy 2: Generic message bubbles
      const messageEls = document.querySelectorAll('[data-testid="conversation-turn"], [class*="message"], [class*="turn"]');
      if (messageEls.length > 0) {
        messageEls.forEach((el) => {
          const isUser = el.getAttribute('data-testid')?.includes('user') ||
                         el.querySelector('img[alt*="User"], [class*="user"]') !== null;
          const role = isUser ? 'user' : 'assistant';
          const textEl = el.querySelector('p, [class*="text"], div');
          if (textEl) {
            const content = textEl.textContent.trim();
            if (content) messages.push({ role, content });
          }
        });
        return messages;
      }

      return messages;
    } catch (e) {
      console.error('[AI Arena] Error extracting conversation from Gemini:', e);
      return [];
    }
  }

  function extractLatestRound() {
    const allMessages = extractConversation();
    if (allMessages.length === 0) return [];

    let lastAssistantIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) return allMessages;

    let lastUserIndex = -1;
    for (let i = lastAssistantIndex - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return [allMessages[lastAssistantIndex]];
    return [allMessages[lastUserIndex], allMessages[lastAssistantIndex]];
  }

  // ───────────────────────────────────────────────
  // Layout Adjustment
  // ───────────────────────────────────────────────
  function findMainElement() {
    const selectors = [
      'main[role="main"]',
      'main',
      '[class*="main-content"]',
      '[class*="chat-container"]',
      '#app',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function adjustLayout(panelOpen, width) {
    if (!geminiMainEl) geminiMainEl = findMainElement();
    if (!geminiMainEl) {
      console.log('[AI Arena] Could not find Gemini main element');
      return;
    }
    if (panelOpen) {
      geminiMainEl.style.marginRight = width + 'px';
      geminiMainEl.style.transition = 'margin-right 0.3s ease';
    } else {
      geminiMainEl.style.marginRight = '0px';
      geminiMainEl.style.transition = 'margin-right 0.3s ease';
    }
  }

  // ───────────────────────────────────────────────
  // Button Injection
  // ───────────────────────────────────────────────
  function injectFloatingButton(onClick) {
    if (document.getElementById('ai-arena-floating-btn')) return;
    const cfg = window.AIArena.Host.getModelConfig();
    window.AIArena.UI.createFloatingButton(cfg, onClick);
    console.log('[AI Arena] Floating button injected on Gemini');
  }

  function injectAnalyzeButton(onClick) {
    if (isButtonInjected) return;
    if (document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = true;
      return;
    }

    const insertionSelectors = [
      'rich-textarea',
      '[data-testid="input-area"]',
      '[class*="input"]',
      'textarea',
      '[role="textbox"]',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      try {
        targetElement = document.querySelector(selector);
        if (targetElement) break;
      } catch (e) { /* skip invalid selector */ }
    }

    if (!targetElement) {
      console.log('[AI Arena] Could not find Gemini insertion point');
      return;
    }

    const cfg = window.AIArena.Host.getModelConfig();
    const button = window.AIArena.UI.createAnalyzeButton(cfg, onClick);

    let container = targetElement.parentElement;
    if (container) {
      let current = container;
      for (let i = 0; i < 4 && current; i++) {
        const style = window.getComputedStyle(current);
        if (style.display === 'flex' || style.display === 'inline-flex') {
          container = current;
          break;
        }
        current = current.parentElement;
      }
    }

    if (container) {
      container.appendChild(button);
      isButtonInjected = true;
    } else {
      targetElement.insertAdjacentElement('afterend', button);
      isButtonInjected = true;
    }
  }

  function onModelChanged() {
    isButtonInjected = false;
    injectAnalyzeButton(window.AIArena.Host.sendAnalyzeRequest);
  }

  // ───────────────────────────────────────────────
  // Register Adapter
  // ───────────────────────────────────────────────
  window.AIArena.Host.registerPlatform({
    name: 'gemini',
    extractConversation,
    extractLatestRound,
    injectFloatingButton,
    injectAnalyzeButton,
    adjustLayout,
    onModelChanged,
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add extension/host/gemini.js
git commit -m "feat(host): add Gemini platform adapter"
```

---

### Task 4: 创建 Kimi Host 适配器

**Files:**
- Create: `extension/host/kimi_host.js`

- [ ] **Step 1: 创建 kimi_host.js**

```javascript
/**
 * AI Arena — Kimi Host Platform Adapter
 *
 * Kimi-specific DOM operations (when kimi.com is the host page):
 * - Conversation extraction from Kimi DOM
 * - Button injection into Kimi input area
 * - Layout adjustment for Kimi main content
 */
(function () {
  'use strict';

  console.log('[AI Arena] Kimi host adapter loading');

  const INJECTION_DELAY_MS = 2000;
  let isButtonInjected = false;
  let kimiMainEl = null;

  // ───────────────────────────────────────────────
  // Conversation Extraction
  // ───────────────────────────────────────────────
  function extractConversation() {
    try {
      const messages = [];

      // Strategy 1: Kimi message items with data attributes
      const messageItems = document.querySelectorAll('[data-testid*="message"], [class*="message-item"], [class*="chat-message"]');
      if (messageItems.length > 0) {
        messageItems.forEach((el) => {
          const isUser = el.getAttribute('data-testid')?.includes('user') ||
                         el.querySelector('img[alt*="User"], [class*="avatar-user"], [class*="user"]') !== null;
          const role = isUser ? 'user' : 'assistant';
          const textEl = el.querySelector('.markdown, [class*="content"], [class*="text"], p');
          if (textEl) {
            const content = textEl.textContent.trim();
            if (content) messages.push({ role, content });
          }
        });
        return messages;
      }

      // Strategy 2: Generic article/message containers
      const articles = document.querySelectorAll('article, [class*="message"], [class*="bubble"]');
      articles.forEach((article) => {
        const isUser = article.querySelector('img[alt*="User"], [class*="user"]') !== null ||
                       article.classList.contains('user');
        const role = isUser ? 'user' : 'assistant';
        const textEls = article.querySelectorAll('.markdown, p, [class*="text"]');
        const content = Array.from(textEls).map(el => el.textContent.trim()).join('\n');
        if (content) messages.push({ role, content });
      });

      return messages;
    } catch (e) {
      console.error('[AI Arena] Error extracting conversation from Kimi:', e);
      return [];
    }
  }

  function extractLatestRound() {
    const allMessages = extractConversation();
    if (allMessages.length === 0) return [];

    let lastAssistantIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) return allMessages;

    let lastUserIndex = -1;
    for (let i = lastAssistantIndex - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return [allMessages[lastAssistantIndex]];
    return [allMessages[lastUserIndex], allMessages[lastAssistantIndex]];
  }

  // ───────────────────────────────────────────────
  // Layout Adjustment
  // ───────────────────────────────────────────────
  function findMainElement() {
    const selectors = [
      'main',
      '[class*="main-content"]',
      '[class*="chat-page"]',
      '#app',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function adjustLayout(panelOpen, width) {
    if (!kimiMainEl) kimiMainEl = findMainElement();
    if (!kimiMainEl) {
      console.log('[AI Arena] Could not find Kimi main element');
      return;
    }
    if (panelOpen) {
      kimiMainEl.style.marginRight = width + 'px';
      kimiMainEl.style.transition = 'margin-right 0.3s ease';
    } else {
      kimiMainEl.style.marginRight = '0px';
      kimiMainEl.style.transition = 'margin-right 0.3s ease';
    }
  }

  // ───────────────────────────────────────────────
  // Button Injection
  // ───────────────────────────────────────────────
  function injectFloatingButton(onClick) {
    if (document.getElementById('ai-arena-floating-btn')) return;
    const cfg = window.AIArena.Host.getModelConfig();
    window.AIArena.UI.createFloatingButton(cfg, onClick);
    console.log('[AI Arena] Floating button injected on Kimi');
  }

  function injectAnalyzeButton(onClick) {
    if (isButtonInjected) return;
    if (document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = true;
      return;
    }

    const insertionSelectors = [
      '.chat-input-editor',
      '[data-lexical-editor="true"]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      '[class*="input"]',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      try {
        targetElement = document.querySelector(selector);
        if (targetElement) break;
      } catch (e) { /* skip invalid selector */ }
    }

    if (!targetElement) {
      console.log('[AI Arena] Could not find Kimi insertion point');
      return;
    }

    const cfg = window.AIArena.Host.getModelConfig();
    const button = window.AIArena.UI.createAnalyzeButton(cfg, onClick);

    let container = targetElement.parentElement;
    if (container) {
      let current = container;
      for (let i = 0; i < 4 && current; i++) {
        const style = window.getComputedStyle(current);
        if (style.display === 'flex' || style.display === 'inline-flex') {
          container = current;
          break;
        }
        current = current.parentElement;
      }
    }

    if (container) {
      container.appendChild(button);
      isButtonInjected = true;
    } else {
      targetElement.insertAdjacentElement('afterend', button);
      isButtonInjected = true;
    }
  }

  function onModelChanged() {
    isButtonInjected = false;
    injectAnalyzeButton(window.AIArena.Host.sendAnalyzeRequest);
  }

  // ───────────────────────────────────────────────
  // Register Adapter
  // ───────────────────────────────────────────────
  window.AIArena.Host.registerPlatform({
    name: 'kimi',
    extractConversation,
    extractLatestRound,
    injectFloatingButton,
    injectAnalyzeButton,
    adjustLayout,
    onModelChanged,
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add extension/host/kimi_host.js
git commit -m "feat(host): add Kimi host platform adapter"
```

---

### Task 5: 创建 Doubao Host 适配器

**Files:**
- Create: `extension/host/doubao_host.js`

- [ ] **Step 1: 创建 doubao_host.js**

```javascript
/**
 * AI Arena — Doubao Host Platform Adapter
 *
 * Doubao-specific DOM operations (when doubao.com is the host page):
 * - Conversation extraction from Doubao DOM
 * - Button injection into Doubao input area
 * - Layout adjustment for Doubao main content
 */
(function () {
  'use strict';

  console.log('[AI Arena] Doubao host adapter loading');

  const INJECTION_DELAY_MS = 2000;
  let isButtonInjected = false;
  let doubaoMainEl = null;

  // ───────────────────────────────────────────────
  // Conversation Extraction
  // ───────────────────────────────────────────────
  function extractConversation() {
    try {
      const messages = [];

      // Strategy 1: Doubao message items
      const messageItems = document.querySelectorAll('[data-testid*="message"], [class*="message-item"], [class*="chat-message"], [class*="message-wrapper"]');
      if (messageItems.length > 0) {
        messageItems.forEach((el) => {
          const isUser = el.getAttribute('data-testid')?.includes('user') ||
                         el.querySelector('img[alt*="User"], [class*="avatar-user"], [class*="user"]') !== null;
          const role = isUser ? 'user' : 'assistant';
          const textEl = el.querySelector('.markdown, [class*="content"], [class*="text"], p, pre');
          if (textEl) {
            const content = textEl.textContent.trim();
            if (content) messages.push({ role, content });
          }
        });
        return messages;
      }

      // Strategy 2: Generic message containers
      const containers = document.querySelectorAll('[class*="message"], article, [class*="bubble"]');
      containers.forEach((el) => {
        const isUser = el.querySelector('img[alt*="User"], [class*="user"]') !== null ||
                       el.classList.contains('user');
        const role = isUser ? 'user' : 'assistant';
        const textEls = el.querySelectorAll('.markdown, p, [class*="text"], pre');
        const content = Array.from(textEls).map(el => el.textContent.trim()).join('\n');
        if (content) messages.push({ role, content });
      });

      return messages;
    } catch (e) {
      console.error('[AI Arena] Error extracting conversation from Doubao:', e);
      return [];
    }
  }

  function extractLatestRound() {
    const allMessages = extractConversation();
    if (allMessages.length === 0) return [];

    let lastAssistantIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) return allMessages;

    let lastUserIndex = -1;
    for (let i = lastAssistantIndex - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return [allMessages[lastAssistantIndex]];
    return [allMessages[lastUserIndex], allMessages[lastAssistantIndex]];
  }

  // ───────────────────────────────────────────────
  // Layout Adjustment
  // ───────────────────────────────────────────────
  function findMainElement() {
    const selectors = [
      'main',
      '[class*="main-content"]',
      '[class*="chat-page"]',
      '#app',
      '[class*="layout-content"]',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function adjustLayout(panelOpen, width) {
    if (!doubaoMainEl) doubaoMainEl = findMainElement();
    if (!doubaoMainEl) {
      console.log('[AI Arena] Could not find Doubao main element');
      return;
    }
    if (panelOpen) {
      doubaoMainEl.style.marginRight = width + 'px';
      doubaoMainEl.style.transition = 'margin-right 0.3s ease';
    } else {
      doubaoMainEl.style.marginRight = '0px';
      doubaoMainEl.style.transition = 'margin-right 0.3s ease';
    }
  }

  // ───────────────────────────────────────────────
  // Button Injection
  // ───────────────────────────────────────────────
  function injectFloatingButton(onClick) {
    if (document.getElementById('ai-arena-floating-btn')) return;
    const cfg = window.AIArena.Host.getModelConfig();
    window.AIArena.UI.createFloatingButton(cfg, onClick);
    console.log('[AI Arena] Floating button injected on Doubao');
  }

  function injectAnalyzeButton(onClick) {
    if (isButtonInjected) return;
    if (document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = true;
      return;
    }

    const insertionSelectors = [
      'textarea.semi-input-textarea',
      'textarea[placeholder*="消息"]',
      'textarea',
      '[class*="input"]',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      try {
        targetElement = document.querySelector(selector);
        if (targetElement) break;
      } catch (e) { /* skip invalid selector */ }
    }

    if (!targetElement) {
      console.log('[AI Arena] Could not find Doubao insertion point');
      return;
    }

    const cfg = window.AIArena.Host.getModelConfig();
    const button = window.AIArena.UI.createAnalyzeButton(cfg, onClick);

    let container = targetElement.parentElement;
    if (container) {
      let current = container;
      for (let i = 0; i < 4 && current; i++) {
        const style = window.getComputedStyle(current);
        if (style.display === 'flex' || style.display === 'inline-flex') {
          container = current;
          break;
        }
        current = current.parentElement;
      }
    }

    if (container) {
      container.appendChild(button);
      isButtonInjected = true;
    } else {
      targetElement.insertAdjacentElement('afterend', button);
      isButtonInjected = true;
    }
  }

  function onModelChanged() {
    isButtonInjected = false;
    injectAnalyzeButton(window.AIArena.Host.sendAnalyzeRequest);
  }

  // ───────────────────────────────────────────────
  // Register Adapter
  // ───────────────────────────────────────────────
  window.AIArena.Host.registerPlatform({
    name: 'doubao',
    extractConversation,
    extractLatestRound,
    injectFloatingButton,
    injectAnalyzeButton,
    adjustLayout,
    onModelChanged,
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add extension/host/doubao_host.js
git commit -m "feat(host): add Doubao host platform adapter"
```

---

### Task 6: 验证扩展结构完整性

**Files:**
- Test: 语法和结构检查

- [ ] **Step 1: 验证所有新文件存在且 manifest.json 格式正确**

```bash
cd /Users/hearmen/Project/AI4Sec/ai_generate/kimi-wp/ai-arena/extension

# Check files exist
ls -la host/gemini.js host/kimi_host.js host/doubao_host.js

# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest.json valid')"

# Check for syntax errors in new JS files (basic parse check)
node --check host/gemini.js
node --check host/kimi_host.js
node --check host/doubao_host.js
```

Expected output:
- All files exist
- `manifest.json valid`
- No syntax errors from `node --check`

- [ ] **Step 2: 确认 content_scripts 加载顺序正确**

检查 `manifest.json` 中每组 content_scripts 的顺序是否为：
1. `shared/utils.js`
2. `shared/registry.js`
3. `host/prompt.js`
4. `host/_core.js`
5. `host/_ui.js`
6. `host/<platform>.js`

这是关键依赖顺序，`_core.js` 依赖 `registry.js`，平台 adapter 依赖 `_core.js`。

- [ ] **Step 3: Commit**

```bash
git add -A
git diff --cached --stat
git commit -m "chore: verify extension structure and syntax"
```

---

### Task 7: 更新版本号并打包

**Files:**
- Modify: `extension/manifest.json:4`
- Modify: `extension/popup.js` (if version displayed)

- [ ] **Step 1: 更新 manifest.json 版本号**

将 `"version": "2.2.0"` 改为 `"version": "2.3.0"`

- [ ] **Step 2: 重新打包扩展**

```bash
cd /Users/hearmen/Project/AI4Sec/ai_generate/kimi-wp/ai-arena
rm -f ai-arena-extension.zip
zip -r ai-arena-extension.zip extension/
```

- [ ] **Step 3: 最终 Commit**

```bash
git add extension/manifest.json ai-arena-extension.zip
git commit -m "chore(release): bump version to 2.3.0, package extension"
```

---

## Self-Review Checklist

- [ ] **Spec coverage**: 所有设计文档中的要求都有对应任务
  - Registry 更新 → Task 1 ✅
  - Manifest 更新 → Task 2 ✅
  - Gemini Host 适配器 → Task 3 ✅
  - Kimi Host 适配器 → Task 4 ✅
  - Doubao Host 适配器 → Task 5 ✅
  - 验证和打包 → Task 6, 7 ✅

- [ ] **Placeholder scan**: 无 TBD、TODO、"implement later"
- [ ] **Type consistency**: 所有 adapter 接口与 chatgpt.js 一致（extractConversation, extractLatestRound, injectFloatingButton, injectAnalyzeButton, adjustLayout, onModelChanged）
- [ ] **文件名冲突**: host 适配器使用 `kimi_host.js` 和 `doubao_host.js`，避免与 `panel/kimi.js`、`panel/doubao.js` 冲突
