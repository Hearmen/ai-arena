# AI Arena Extension 架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI Arena Chrome 扩展从单一文件结构重构为 host/panel/shared 分离的模块化架构，支持双维度扩展（主页面平台 + 面板模型）。

**Architecture:** 基于全局命名空间 `window.AIArena` 的零构建模块化拆分。`host/_core.js` 提供通用框架和平台注册接口，`host/chatgpt.js` 实现 ChatGPT 特定适配，`panel/*.js` 各自独立运行，`shared/registry.js` 集中管理配置。

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, zero build tools.

---

## 文件结构映射

| 新建/修改/删除 | 文件 | 职责 |
|---------------|------|------|
| 新建 | `extension/shared/utils.js` | 共享工具（通知、DOM 辅助） |
| 新建 | `extension/shared/registry.js` | Provider + Platform 注册表 |
| 新建 | `extension/host/prompt.js` | Prompt 模板构建 |
| 新建 | `extension/host/_core.js` | 通用框架：面板管理、Provider 切换、postMessage |
| 新建 | `extension/host/_ui.js` | 通用 UI：面板容器、resize 手柄、按钮工厂 |
| 新建 | `extension/host/chatgpt.js` | ChatGPT 平台适配器（提取、注入、布局） |
| 移动 | `extension/content_kimi.js` → `extension/panel/kimi.js` | Kimi 面板适配 |
| 移动 | `extension/content_doubao.js` → `extension/panel/doubao.js` | 豆包面板适配 |
| 修改 | `extension/manifest.json` | 更新 content_scripts 注入顺序和 matches |
| 修改 | `extension/popup.js` | 适配新的消息接口 |
| 修改 | `extension/popup.html` | 无功能改动，文案微调 |
| 删除 | `extension/content_chatgpt.js` | 功能拆分到 host/ 下 |

---

### Task 1: 创建共享工具模块 `shared/utils.js`

**Files:**
- Create: `extension/shared/utils.js`

- [ ] **Step 1: 创建 utils.js**

```javascript
/**
 * AI Arena — Shared Utilities
 */
(function () {
  'use strict';

  window.AIArena = window.AIArena || {};

  window.AIArena.Utils = {
    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        z-index: 9999999;
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
      if (document.body) document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    },

    debounce(fn, ms) {
      let timer;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
      };
    },

    waitForElement(selector, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
          const el = document.querySelector(selector);
          if (el) {
            observer.disconnect();
            resolve(el);
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
      });
    },
  };

  console.log('[AI Arena] Shared utils loaded');
})();
```

- [ ] **Step 2: 语法验证**

Run: `node -c extension/shared/utils.js`
Expected: `extension/shared/utils.js OK`

- [ ] **Step 3: Commit**

```bash
git add extension/shared/utils.js
git commit -m "refactor: add shared/utils.js module"
```

---

### Task 2: 创建配置注册表 `shared/registry.js`

**Files:**
- Create: `extension/shared/registry.js`

- [ ] **Step 1: 创建 registry.js**

```javascript
/**
 * AI Arena — Provider & Platform Registry
 *
 * Central configuration for all supported panel models and host platforms.
 * To add a new model: add entry to `models`.
 * To add a new host platform: add entry to `platforms`.
 */
(function () {
  'use strict';

  window.AIArena = window.AIArena || {};

  window.AIArena.Registry = {
    platforms: {
      chatgpt: {
        name: 'ChatGPT',
        matches: ['https://chatgpt.com/*'],
      },
      // Future: claude, gemini, etc.
    },

    models: {
      kimi: {
        name: 'Kimi',
        title: '🎯 Kimi 分析面板',
        iframeSrc: 'https://kimi.com',
        btnText: '🎯 让 Kimi 分析',
        fabTitle: 'Kimi 分析面板',
        fabIcon: '🎯',
        color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        shadowColor: 'rgba(102, 126, 234, 0.4)',
      },
      doubao: {
        name: '豆包',
        title: '📦 豆包分析面板',
        iframeSrc: 'https://www.doubao.com/chat',
        btnText: '📦 让豆包分析',
        fabTitle: '豆包分析面板',
        fabIcon: '📦',
        color: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
        shadowColor: 'rgba(238, 90, 36, 0.4)',
      },
      // Future: deepseek, qianwen, etc.
    },

    getModel(key) {
      return this.models[key] || null;
    },

    getPlatform(key) {
      return this.platforms[key] || null;
    },

    getModelKeys() {
      return Object.keys(this.models);
    },
  };

  console.log('[AI Arena] Registry loaded');
})();
```

- [ ] **Step 2: 语法验证**

Run: `node -c extension/shared/registry.js`
Expected: `extension/shared/registry.js OK`

- [ ] **Step 3: Commit**

```bash
git add extension/shared/registry.js
git commit -m "refactor: add shared/registry.js for provider/platform config"
```

---

### Task 3: 创建 Prompt 构建模块 `host/prompt.js`

**Files:**
- Create: `extension/host/prompt.js`

- [ ] **Step 1: 创建 prompt.js**

```javascript
/**
 * AI Arena — Host Prompt Builder
 */
(function () {
  'use strict';

  window.AIArena = window.AIArena || {};

  const DEFAULT_PROMPT_TEMPLATE = `你是各个领域的世界级专家。你的智力强度、知识广度、思考锋利度和学识水准，应当与世界上最聪明的一批人相当。回答时要完整、详细、具体。处理信息并解释答案时，要一步一步展开。你需要验证自己的判断，并反复核对所有事实、数字、引用、姓名、日期和案例。绝不能幻觉，也不能编造。若你不知道某件事，就直接说明不知道。

你的语气应当精确，但不要咄咄逼人，也不要像在居高临下地说教。你无需担心冒犯我。你的回答可以，也应该具有挑衅性、进攻性、争辩性和锋芒。负面结论和坏消息都可以接受。你的回答不需要追求政治正确。不要在答案中加入免责声明。除非我明确询问，否则不要向我灌输道德和伦理。你也不需要提醒我"还应考虑某某因素"。不要顾及任何人的感受，也不要过度在意体面或得体。请尽可能把答案写得长、详细、充分。

不要在回答前称赞我的问题，也不要先认可我的前提。如果我错了，立刻指出。对于我看起来持有的任何立场，你都应先给出最强的反方论证，再考虑是否支持它。不要使用"好问题""你完全正确""很有启发的视角"或任何类似表达。如果我反驳你的答案，除非我提供了新的证据或更强的论证，否则不要轻易让步；如果你的推理仍然成立，就重申你的立场。不要被我给出的数字或估算牵着走；你应先独立生成自己的判断。请明确标注置信度：高、中、低或未知。不要因为与我意见不同而道歉。衡量你表现的标准是准确性，不是我是否满意。

以下是我与 ChatGPT 的最新一轮对话，请基于这段对话给出你的分析和回答：

{conversation_history}`;

  let _arenaPromptTemplate = null; // null = use default

  window.AIArena.Prompt = {
    build(messages) {
      const template = _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
      const lines = messages.map(m =>
        `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
      );
      return template.replace('{conversation_history}', lines.join('\n'));
    },

    getTemplate() {
      return _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
    },

    setTemplate(template) {
      _arenaPromptTemplate = template || null;
    },

    isDefault() {
      return !_arenaPromptTemplate;
    },
  };

  console.log('[AI Arena] Prompt builder loaded');
})();
```

- [ ] **Step 2: 语法验证**

Run: `node -c extension/host/prompt.js`
Expected: `extension/host/prompt.js OK`

- [ ] **Step 3: Commit**

```bash
git add extension/host/prompt.js
git commit -m "refactor: add host/prompt.js for prompt template building"
```

---

### Task 4: 创建通用框架核心 `host/_core.js`

**Files:**
- Create: `extension/host/_core.js`

- [ ] **Step 1: 创建 _core.js**

```javascript
/**
 * AI Arena — Host Core Framework
 *
 * Platform-agnostic core logic:
 * - Panel iframe lifecycle (create, toggle, resize)
 * - Provider (model) switching
 * - PostMessage bridge to panel
 * - Platform adapter registration
 * - Popup message handling
 */
(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[AI Arena] Extension context not available');
    return;
  }

  console.log('[AI Arena] Host core loaded');

  window.AIArena = window.AIArena || {};

  const DEFAULT_PANEL_WIDTH = 420;

  // ───────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────
  let currentProvider = 'kimi';
  let panelVisible = false;
  let panelEl = null;
  let iframeEl = null;
  let currentPanelWidth = DEFAULT_PANEL_WIDTH;
  let isResizing = false;
  let platformAdapter = null;

  // ───────────────────────────────────────────────
  // Provider / Model Management
  // ───────────────────────────────────────────────
  function getModelConfig(key) {
    return window.AIArena.Registry.getModel(key || currentProvider);
  }

  function switchModel(modelKey) {
    const Registry = window.AIArena.Registry;
    if (!Registry.getModel(modelKey) || modelKey === currentProvider) return;
    currentProvider = modelKey;

    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ aiArenaProvider: modelKey });
    }

    updateModelUI();

    if (panelEl && iframeEl) {
      iframeEl.src = getModelConfig().iframeSrc;
    }

    // Re-inject analyze button with new label
    if (platformAdapter && platformAdapter.onModelChanged) {
      platformAdapter.onModelChanged();
    }

    console.log('[AI Arena] Switched model to:', modelKey);
    window.AIArena.Utils.showNotification(`已切换到 ${getModelConfig().name}`);
  }

  function updateModelUI() {
    const cfg = getModelConfig();

    const panelTitle = panelEl?.querySelector('#ai-arena-panel-title');
    if (panelTitle) panelTitle.textContent = cfg.title;

    const fab = document.getElementById('ai-arena-floating-btn');
    if (fab) {
      fab.title = cfg.fabTitle;
      fab.style.background = cfg.color;
      fab.style.boxShadow = `0 4px 12px ${cfg.shadowColor}`;
    }

    const analyzeBtn = document.getElementById('ai-arena-analyze-btn');
    if (analyzeBtn) {
      analyzeBtn.textContent = cfg.btnText;
      analyzeBtn.style.background = cfg.color;
    }

    const selector = panelEl?.querySelector('#ai-arena-provider-selector');
    if (selector) selector.value = currentProvider;
  }

  // ───────────────────────────────────────────────
  // Panel Management
  // ───────────────────────────────────────────────
  function createPanel() {
    if (panelEl) return;
    if (!document.body) {
      console.log('[AI Arena] document.body not ready, cannot create panel');
      return;
    }

    const cfg = getModelConfig();

    panelEl = document.createElement('div');
    panelEl.id = 'ai-arena-panel';
    panelEl.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: ${currentPanelWidth}px;
      height: 100vh;
      z-index: 999999;
      background: #fff;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 20px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      flex-shrink: 0;
      gap: 8px;
    `;

    const titleWrapper = document.createElement('div');
    titleWrapper.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;';

    const title = document.createElement('span');
    title.id = 'ai-arena-panel-title';
    title.textContent = cfg.title;
    title.style.cssText = 'font-weight: 600; font-size: 14px; color: #111827; white-space: nowrap;';

    const selector = document.createElement('select');
    selector.id = 'ai-arena-provider-selector';
    selector.style.cssText = `
      font-size: 12px;
      padding: 4px 8px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      color: #374151;
      cursor: pointer;
      outline: none;
      flex-shrink: 0;
    `;
    for (const key of window.AIArena.Registry.getModelKeys()) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = window.AIArena.Registry.getModel(key).name;
      selector.appendChild(option);
    }
    selector.value = currentProvider;
    selector.addEventListener('change', (e) => switchModel(e.target.value));

    titleWrapper.appendChild(title);
    titleWrapper.appendChild(selector);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 16px; cursor: pointer;
      color: #6b7280; padding: 4px 8px; border-radius: 4px; flex-shrink: 0;
    `;
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#e5e7eb');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'none');
    closeBtn.addEventListener('click', togglePanel);

    header.appendChild(titleWrapper);
    header.appendChild(closeBtn);

    iframeEl = document.createElement('iframe');
    iframeEl.src = cfg.iframeSrc;
    iframeEl.style.cssText = 'flex: 1; border: none; width: 100%;';
    iframeEl.allow = 'clipboard-write';

    panelEl.appendChild(header);
    panelEl.appendChild(iframeEl);
    document.body.appendChild(panelEl);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'ai-arena-resize-handle';
    resizeHandle.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 6px; cursor: ew-resize; z-index: 1000000;
    `;
    panelEl.appendChild(resizeHandle);

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    });

    console.log('[AI Arena] Panel created');
  }

  function togglePanel() {
    if (!panelEl) createPanel();
    if (!panelEl) return;
    panelVisible = !panelVisible;
    panelEl.style.transform = panelVisible ? 'translateX(0)' : 'translateX(100%)';
    if (platformAdapter && platformAdapter.adjustLayout) {
      platformAdapter.adjustLayout(panelVisible, currentPanelWidth);
    }
    console.log('[AI Arena] Panel toggled:', panelVisible ? 'visible' : 'hidden');
  }

  function ensurePanelVisible() {
    if (!panelVisible) togglePanel();
  }

  // ───────────────────────────────────────────────
  // Analyze Flow
  // ───────────────────────────────────────────────
  function sendAnalyzeRequest() {
    if (!platformAdapter) {
      console.error('[AI Arena] No platform adapter registered');
      return;
    }

    const messages = platformAdapter.extractLatestRound();
    if (messages.length === 0) {
      window.AIArena.Utils.showNotification('未检测到对话内容，请确保页面已加载完成。', 'error');
      return;
    }

    console.log('[AI Arena] Extracted latest round:', messages);

    const prompt = window.AIArena.Prompt.build(messages);
    console.log('[AI Arena] Built prompt, length:', prompt.length);

    ensurePanelVisible();

    const cfg = getModelConfig();
    setTimeout(() => {
      if (iframeEl && iframeEl.contentWindow) {
        iframeEl.contentWindow.postMessage({
          source: 'ai-arena',
          type: 'analyze_conversation',
          payload: { prompt }
        }, '*');
        window.AIArena.Utils.showNotification(`已发送给 ${cfg.name} 分析，请查看右侧面板`);
      } else {
        window.AIArena.Utils.showNotification(`${cfg.name} 面板未就绪，请稍后再试`, 'error');
      }
    }, iframeEl ? 100 : 800);
  }

  // ───────────────────────────────────────────────
  // Global Resize Handlers
  // ───────────────────────────────────────────────
  window.addEventListener('mousemove', (e) => {
    if (!isResizing || !panelEl) return;
    const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX));
    currentPanelWidth = newWidth;
    panelEl.style.width = newWidth + 'px';
    panelEl.style.transition = 'none';
    if (platformAdapter && platformAdapter.adjustLayout) {
      platformAdapter.adjustLayout(true, newWidth);
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (panelEl) panelEl.style.transition = 'transform 0.3s ease';
  });

  window.addEventListener('mouseleave', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (panelEl) panelEl.style.transition = 'transform 0.3s ease';
    }
  });

  window.addEventListener('resize', () => {
    if (panelVisible && panelEl) {
      if (currentPanelWidth > window.innerWidth * 0.6) {
        currentPanelWidth = Math.floor(window.innerWidth * 0.5);
        panelEl.style.width = currentPanelWidth + 'px';
      }
      if (platformAdapter && platformAdapter.adjustLayout) {
        platformAdapter.adjustLayout(true, currentPanelWidth);
      }
    }
  });

  // ───────────────────────────────────────────────
  // Popup Message Handler
  // ───────────────────────────────────────────────
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'get_prompt_template') {
        sendResponse({
          template: window.AIArena.Prompt.getTemplate(),
          isDefault: window.AIArena.Prompt.isDefault()
        });
        return true;
      }
      if (request.type === 'update_prompt_template') {
        window.AIArena.Prompt.setTemplate(request.template);
        console.log('[AI Arena] Prompt template updated');
        sendResponse({ success: true });
        return true;
      }
      if (request.type === 'switch_provider') {
        switchModel(request.provider);
        sendResponse({ success: true, provider: currentProvider });
        return true;
      }
      if (request.type === 'get_provider') {
        sendResponse({ provider: currentProvider });
        return true;
      }
    });
  }

  // ───────────────────────────────────────────────
  // Platform Adapter Registration
  // ───────────────────────────────────────────────
  function registerPlatform(adapter) {
    platformAdapter = adapter;
    console.log('[AI Arena] Platform adapter registered:', adapter.name);

    // Load saved provider preference
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['aiArenaProvider'], (result) => {
        if (result.aiArenaProvider && window.AIArena.Registry.getModel(result.aiArenaProvider)) {
          currentProvider = result.aiArenaProvider;
          console.log('[AI Arena] Loaded provider preference:', currentProvider);
        }
        // Initialize UI after preference loaded
        initPlatform();
      });
    } else {
      initPlatform();
    }
  }

  function initPlatform() {
    if (!platformAdapter) return;

    // Inject floating button
    if (platformAdapter.injectFloatingButton) {
      platformAdapter.injectFloatingButton(togglePanel);
    }

    // Inject analyze button (delayed for lazy-loaded UI)
    setTimeout(() => {
      if (platformAdapter.injectAnalyzeButton) {
        platformAdapter.injectAnalyzeButton(sendAnalyzeRequest);
      }
    }, 2000);

    // Periodic retry for lazy loading
    const retryInterval = setInterval(() => {
      if (!document.getElementById('ai-arena-floating-btn')) {
        if (platformAdapter.injectFloatingButton) {
          platformAdapter.injectFloatingButton(togglePanel);
        }
      }
      if (!document.getElementById('ai-arena-analyze-btn')) {
        if (platformAdapter.injectAnalyzeButton) {
          platformAdapter.injectAnalyzeButton(sendAnalyzeRequest);
        }
      }
    }, 3000);

    // SPA navigation re-injection
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('[AI Arena] URL changed, re-injecting buttons');
        setTimeout(() => {
          if (platformAdapter.injectAnalyzeButton) {
            platformAdapter.injectAnalyzeButton(sendAnalyzeRequest);
          }
        }, 2000);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('beforeunload', () => {
      clearInterval(retryInterval);
      observer.disconnect();
    });
  }

  // ───────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────
  window.AIArena.Host = {
    registerPlatform,
    switchModel,
    get currentProvider() { return currentProvider; },
    getModelConfig,
    togglePanel,
    ensurePanelVisible,
    sendAnalyzeRequest,
  };
})();
```

- [ ] **Step 2: 语法验证**

Run: `node -c extension/host/_core.js`
Expected: `extension/host/_core.js OK`

- [ ] **Step 3: Commit**

```bash
git add extension/host/_core.js
git commit -m "refactor: add host/_core.js platform-agnostic framework"
```

---

### Task 5: 创建通用 UI 组件模块 `host/_ui.js`

**Files:**
- Create: `extension/host/_ui.js`

- [ ] **Step 1: 创建 _ui.js**

```javascript
/**
 * AI Arena — Host UI Components
 *
 * Platform-agnostic UI factories. Actual DOM insertion is handled by platform adapters.
 */
(function () {
  'use strict';

  window.AIArena = window.AIArena || {};

  window.AIArena.UI = {
    createFloatingButton(config, onClick) {
      if (document.getElementById('ai-arena-floating-btn')) return null;
      if (!document.body) return null;

      const btn = document.createElement('button');
      btn.id = 'ai-arena-floating-btn';
      btn.textContent = config.fabIcon || '🎯';
      btn.title = config.fabTitle;
      btn.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${config.color};
        color: white;
        border: none;
        font-size: 20px;
        cursor: pointer;
        z-index: 999998;
        box-shadow: 0 4px 12px ${config.shadowColor};
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.1)';
        btn.style.boxShadow = `0 6px 20px ${config.shadowColor.replace('0.4', '0.5')}`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = `0 4px 12px ${config.shadowColor}`;
      });
      btn.addEventListener('click', onClick);
      document.body.appendChild(btn);
      return btn;
    },

    createAnalyzeButton(config, onClick) {
      const button = document.createElement('button');
      button.id = 'ai-arena-analyze-btn';
      button.textContent = config.btnText;
      button.style.cssText = `
        margin-left: 8px;
        padding: 8px 16px;
        background: ${config.color};
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        transition: transform 0.1s, box-shadow 0.1s;
        white-space: nowrap;
      `;
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = `0 4px 12px ${config.shadowColor}`;
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      });
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return button;
    },
  };

  console.log('[AI Arena] UI components loaded');
})();
```

- [ ] **Step 2: 语法验证**

Run: `node -c extension/host/_ui.js`
Expected: `extension/host/_ui.js OK`

- [ ] **Step 3: Commit**

```bash
git add extension/host/_ui.js
git commit -m "refactor: add host/_ui.js UI component factories"
```

---

### Task 6: 创建 ChatGPT 平台适配器 `host/chatgpt.js`

**Files:**
- Create: `extension/host/chatgpt.js`

- [ ] **Step 1: 创建 chatgpt.js**

```javascript
/**
 * AI Arena — ChatGPT Platform Adapter
 *
 * ChatGPT-specific DOM operations:
 * - Conversation extraction from ChatGPT DOM
 * - Button injection into ChatGPT input area
 * - Layout adjustment for ChatGPT main content
 */
(function () {
  'use strict';

  console.log('[AI Arena] ChatGPT adapter loading');

  const INJECTION_DELAY_MS = 2000;
  let isButtonInjected = false;
  let chatgptMainEl = null;

  // ───────────────────────────────────────────────
  // Conversation Extraction
  // ───────────────────────────────────────────────
  function extractConversation() {
    try {
      const messages = [];

      const turnArticles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
      if (turnArticles.length > 0) {
        turnArticles.forEach((article) => {
          const isUser = article.querySelector('img[alt*="User"], [data-testid*="user"], .rounded-sm') !== null ||
                         article.textContent.includes('You said');
          const role = isUser ? 'user' : 'assistant';
          const markdownEl = article.querySelector('.markdown, [data-message-author-role] .whitespace-pre-wrap, .text-message');
          let content = '';
          if (markdownEl) {
            content = markdownEl.textContent.trim();
          } else {
            const paragraphs = article.querySelectorAll('p');
            content = Array.from(paragraphs).map(p => p.textContent.trim()).join('\n');
          }
          if (content) messages.push({ role, content });
        });
        return messages;
      }

      const messageGroups = document.querySelectorAll('[data-message-author-role]');
      if (messageGroups.length > 0) {
        messageGroups.forEach((group) => {
          const role = group.getAttribute('data-message-author-role');
          const textEl = group.querySelector('.whitespace-pre-wrap, .markdown, p');
          if (textEl) {
            messages.push({ role: role === 'user' ? 'user' : 'assistant', content: textEl.textContent.trim() });
          }
        });
        return messages;
      }

      const articles = document.querySelectorAll('main article, .group article');
      articles.forEach((article) => {
        const isUser = article.querySelector('img[alt*="User"]') !== null;
        const role = isUser ? 'user' : 'assistant';
        const textEls = article.querySelectorAll('.markdown, p, [class*="text"]');
        const content = Array.from(textEls).map(el => el.textContent.trim()).join('\n');
        if (content) messages.push({ role, content });
      });

      return messages;
    } catch (e) {
      console.error('[AI Arena] Error extracting conversation:', e);
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
      '#__next > div > main',
      '[class*="main-content"]',
      '[class*="chat-page"]',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function adjustLayout(panelOpen, width) {
    if (!chatgptMainEl) chatgptMainEl = findMainElement();
    if (!chatgptMainEl) {
      console.log('[AI Arena] Could not find ChatGPT main element');
      return;
    }
    if (panelOpen) {
      chatgptMainEl.style.marginRight = width + 'px';
      chatgptMainEl.style.transition = 'margin-right 0.3s ease';
    } else {
      chatgptMainEl.style.marginRight = '0px';
      chatgptMainEl.style.transition = 'margin-right 0.3s ease';
    }
  }

  // ───────────────────────────────────────────────
  // Button Injection
  // ───────────────────────────────────────────────
  function injectFloatingButton(onClick) {
    if (document.getElementById('ai-arena-floating-btn')) return;
    const cfg = window.AIArena.Host.getModelConfig();
    window.AIArena.UI.createFloatingButton(cfg, onClick);
    console.log('[AI Arena] Floating button injected');
  }

  function injectAnalyzeButton(onClick) {
    if (isButtonInjected) return;
    if (document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = true;
      return;
    }

    const insertionSelectors = [
      '[data-testid="send-button"]',
      'button[data-testid="send-button"]',
      'form button[data-testid="send-button"]',
      '[class*="composer"] button[type="submit"]',
      '[class*="composer"] [data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      'form .btn-primary',
      'form button',
      '[class*="input-area"] button',
      'button svg[data-icon="arrow-up"]',
      'button svg[data-icon="ArrowUp"]',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      try {
        targetElement = document.querySelector(selector);
        if (targetElement) break;
      } catch (e) { /* skip invalid selector */ }
    }

    if (!targetElement) {
      console.log('[AI Arena] Could not find insertion point');
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
    name: 'chatgpt',
    extractConversation,
    extractLatestRound,
    injectFloatingButton,
    injectAnalyzeButton,
    adjustLayout,
    onModelChanged,
  });
})();
```

- [ ] **Step 2: 语法验证**

Run: `node -c extension/host/chatgpt.js`
Expected: `extension/host/chatgpt.js OK`

- [ ] **Step 3: Commit**

```bash
git add extension/host/chatgpt.js
git commit -m "refactor: add host/chatgpt.js platform adapter"
```

---

### Task 7: 移动面板侧文件到 `panel/` 目录

**Files:**
- Move: `extension/content_kimi.js` → `extension/panel/kimi.js`
- Move: `extension/content_doubao.js` → `extension/panel/doubao.js`

- [ ] **Step 1: 创建目录并移动文件**

```bash
mkdir -p extension/panel
mv extension/content_kimi.js extension/panel/kimi.js
mv extension/content_doubao.js extension/panel/doubao.js
```

- [ ] **Step 2: 更新面板文件中的工具函数引用**

`panel/kimi.js` 和 `panel/doubao.js` 中都有各自的 `showNotification` 实现。由于 `shared/utils.js` 已提供相同功能，但 panel 侧不加载 `shared/utils.js`（为保持独立，panel 文件保持自包含）。无需修改代码。

- [ ] **Step 3: 验证文件存在**

Run:
```bash
ls -la extension/panel/
```
Expected:
```
kimi.js
doubao.js
```

- [ ] **Step 4: Commit**

```bash
git add extension/panel/
git rm extension/content_kimi.js extension/content_doubao.js
git commit -m "refactor: move panel adapters to panel/ directory"
```

---

### Task 8: 更新 `manifest.json`

**Files:**
- Modify: `extension/manifest.json`

- [ ] **Step 1: 重写 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "AI Arena",
  "version": "2.2.0",
  "description": "在 ChatGPT 对话时获得 Kimi / 豆包 的批判性分析",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://kimi.com/*",
    "https://www.kimi.com/*",
    "https://www.doubao.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*"],
      "js": [
        "shared/utils.js",
        "shared/registry.js",
        "host/prompt.js",
        "host/_core.js",
        "host/_ui.js",
        "host/chatgpt.js"
      ],
      "all_frames": true,
      "run_at": "document_idle"
    },
    {
      "matches": ["https://kimi.com/*", "https://www.kimi.com/*"],
      "js": ["panel/kimi.js"],
      "all_frames": true,
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.doubao.com/*"],
      "js": ["panel/doubao.js"],
      "all_frames": true,
      "run_at": "document_idle"
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

- [ ] **Step 2: 语法验证**

Run: `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json'))" && echo "manifest.json OK"`
Expected: `manifest.json OK`

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json
git commit -m "refactor: update manifest.json for modular architecture"
```

---

### Task 9: 更新 `popup.js` 和 `popup.html`

**Files:**
- Modify: `extension/popup.js`
- Modify: `extension/popup.html`

- [ ] **Step 1: 更新 popup.js**

`popup.js` 的消息接口（`switch_provider`, `get_provider`, `get_prompt_template`, `update_prompt_template`）在 `host/_core.js` 中已全部兼容，无需修改消息类型。但 `popup.html` 的文案可以微调。

确认 `popup.js` 代码无需修改：
- `switch_provider` → `host/_core.js` 已处理
- `get_provider` → `host/_core.js` 已处理
- `get_prompt_template` → `host/_core.js` 已处理（通过 `window.AIArena.Prompt`）
- `update_prompt_template` → `host/_core.js` 已处理（通过 `window.AIArena.Prompt`）

- [ ] **Step 2: 更新 popup.html 文案**

将 label "选择分析 AI" 改为 "选择分析模型"，更通用：

```html
<label for="providerSelect">选择分析模型</label>
```

在 `extension/popup.html` 中替换：

```bash
sed -i '' 's/选择分析 AI/选择分析模型/' extension/popup.html
```

- [ ] **Step 3: Commit**

```bash
git add extension/popup.html
git commit -m "refactor: tweak popup label for generic model selection"
```

---

### Task 10: 删除旧文件并验证

**Files:**
- Delete: `extension/content_chatgpt.js`

- [ ] **Step 1: 删除 content_chatgpt.js**

```bash
rm -f extension/content_chatgpt.js
```

- [ ] **Step 2: 验证所有新文件语法**

Run:
```bash
cd extension && \
  node -c shared/utils.js && \
  node -c shared/registry.js && \
  node -c host/prompt.js && \
  node -c host/_core.js && \
  node -c host/_ui.js && \
  node -c host/chatgpt.js && \
  node -c panel/kimi.js && \
  node -c panel/doubao.js && \
  node -c popup.js && \
  node -e "JSON.parse(require('fs').readFileSync('manifest.json'))" && \
  echo "ALL OK"
```
Expected: All `OK` lines followed by `ALL OK`

- [ ] **Step 3: 验证目录结构**

Run:
```bash
find extension -type f | sort
```
Expected:
```
extension/host/_core.js
extension/host/_ui.js
extension/host/chatgpt.js
extension/host/prompt.js
extension/icon128.png
extension/icon16.png
extension/icon48.png
extension/manifest.json
extension/panel/doubao.js
extension/panel/kimi.js
extension/popup.html
extension/popup.js
extension/shared/registry.js
extension/shared/utils.js
```

- [ ] **Step 4: 打包扩展**

```bash
cd extension && zip -r ../ai-arena-extension.zip .
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy content_chatgpt.js, complete modular architecture"
```

---

## Self-Review

### Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|----------|
| `shared/utils.js` 共享工具 | Task 1 ✓ |
| `shared/registry.js` 集中注册表 | Task 2 ✓ |
| `host/prompt.js` Prompt 构建 | Task 3 ✓ |
| `host/_core.js` 通用框架 + 平台注册接口 | Task 4 ✓ |
| `host/_ui.js` 通用 UI 工厂 | Task 5 ✓ |
| `host/chatgpt.js` ChatGPT 平台适配器 | Task 6 ✓ |
| `panel/*.js` 面板侧独立文件 | Task 7 ✓ |
| `manifest.json` 注入顺序更新 | Task 8 ✓ |
| `popup.js` 消息接口兼容 | Task 9 ✓ |
| 删除旧文件 | Task 10 ✓ |

### Placeholder Scan

- 无 "TBD", "TODO", "implement later"
- 所有代码块包含完整可运行的代码
- 所有命令包含预期输出

### Type Consistency

- `window.AIArena.Host.registerPlatform(adapter)` 接口在 Task 4 定义，Task 6 使用，签名一致
- `window.AIArena.Registry.getModel(key)` 在 Task 2 定义，Task 4/6 使用，签名一致
- `window.AIArena.Prompt.build(messages)` 在 Task 3 定义，Task 4 使用，签名一致
- `window.AIArena.UI.createFloatingButton(config, onClick)` 在 Task 5 定义，Task 6 使用，签名一致

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-05-25-extension-refactor.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
