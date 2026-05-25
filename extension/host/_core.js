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
      const cfg = getModelConfig();
      if (cfg.iframeSrc) {
        iframeEl.src = cfg.iframeSrc;
      } else {
        // Show placeholder when no provider selected
        iframeEl.src = 'about:blank';
        iframeEl.onload = () => {
          const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(`
              <!DOCTYPE html>
              <html>
              <head><meta charset="UTF-8"><style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #6b7280; text-align: center; }
                .wrap { padding: 20px; }
                h3 { margin: 0 0 8px; font-size: 16px; color: #374151; }
                p { margin: 0; font-size: 14px; }
              </style></head>
              <body>
                <div class="wrap">
                  <h3>AI Arena 已关闭</h3>
                  <p>请从上方下拉框选择要使用的分析平台</p>
                </div>
              </body>
              </html>
            `);
            doc.close();
          }
        };
        iframeEl.onload?.();
      }
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
    iframeEl.style.cssText = 'flex: 1; border: none; width: 100%;';
    iframeEl.allow = 'clipboard-write';
    if (cfg.iframeSrc) {
      iframeEl.src = cfg.iframeSrc;
    } else {
      iframeEl.src = 'about:blank';
      iframeEl.onload = () => {
        const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><style>
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #6b7280; text-align: center; }
              .wrap { padding: 20px; }
              h3 { margin: 0 0 8px; font-size: 16px; color: #374151; }
              p { margin: 0; font-size: 14px; }
            </style></head>
            <body>
              <div class="wrap">
                <h3>AI Arena 已关闭</h3>
                <p>请从上方下拉框选择要使用的分析平台</p>
              </div>
            </body>
            </html>
          `);
          doc.close();
        }
      };
    }

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

    if (currentProvider === 'none') {
      window.AIArena.Utils.showNotification('请先选择分析平台（点击面板顶部下拉框）', 'error');
      ensurePanelVisible();
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
