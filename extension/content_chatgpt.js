/**
 * AI Arena — ChatGPT Content Script (V2.1)
 *
 * Injected into chatgpt.com to:
 * 1. Extract conversation history
 * 2. Inject floating button 🎯 and side panel with Kimi iframe
 * 3. Inject "让 Kimi 分析" button into ChatGPT input area
 * 4. Build prompt locally and send to Kimi iframe via postMessage
 */

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[AI Arena] Extension context not available');
    return;
  }

  console.log('[AI Arena] ChatGPT content script loaded (V2.1)');

  const INJECTION_DELAY_MS = 2000;
  const RETRY_INTERVAL_MS = 3000;
  let isButtonInjected = false;
  let panelVisible = false;
  let panelEl = null;
  let iframeEl = null;
  let initAttempts = 0;
  const MAX_INIT_ATTEMPTS = 20;

  // ───────────────────────────────────────────────
  // Prompt Builder
  // ───────────────────────────────────────────────
  const CRITIC_PROMPT_TEMPLATE = `你是一位批判性思维专家。用户正在与 ChatGPT 讨论一个话题。
请基于以下对话历史，提供批判性分析：

1. 指出 ChatGPT 观点中可能存在的漏洞、偏见或过度简化
2. 提出被忽略的不同视角或反方论据
3. 建议用户进一步思考的方向
4. 保持客观、理性，不要为反对而反对

对话历史：
{conversation_history}

请用中文给出你的分析，结构清晰，分点论述。`;

  function buildPrompt(messages) {
    const lines = messages.map(m =>
      `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
    );
    return CRITIC_PROMPT_TEMPLATE.replace('{conversation_history}', lines.join('\n'));
  }

  // ───────────────────────────────────────────────
  // Conversation Extraction
  // ───────────────────────────────────────────────
  function extractConversation() {
    try {
      const messages = [];

      // Strategy 1: conversation-turn articles (most common)
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

      // Strategy 2: message groups with role attributes
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

      // Strategy 3: generic articles
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

  // ───────────────────────────────────────────────
  // UI: Notification
  // ───────────────────────────────────────────────
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
  }

  // ───────────────────────────────────────────────
  // UI: Side Panel with Kimi iframe
  // ───────────────────────────────────────────────
  function createSidePanel() {
    if (panelEl) return;
    if (!document.body) {
      console.log('[AI Arena] document.body not ready, cannot create panel');
      return;
    }

    panelEl = document.createElement('div');
    panelEl.id = 'ai-arena-panel';
    panelEl.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 420px;
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
    `;
    const title = document.createElement('span');
    title.textContent = '🎯 Kimi 分析面板';
    title.style.cssText = 'font-weight: 600; font-size: 14px; color: #111827;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 16px; cursor: pointer;
      color: #6b7280; padding: 4px 8px; border-radius: 4px;
    `;
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#e5e7eb');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'none');
    closeBtn.addEventListener('click', togglePanel);
    header.appendChild(title);
    header.appendChild(closeBtn);

    iframeEl = document.createElement('iframe');
    iframeEl.src = 'https://kimi.com';
    iframeEl.style.cssText = 'flex: 1; border: none; width: 100%;';
    iframeEl.allow = 'clipboard-write';

    panelEl.appendChild(header);
    panelEl.appendChild(iframeEl);
    document.body.appendChild(panelEl);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 6px; cursor: ew-resize; z-index: 1;
    `;
    panelEl.appendChild(resizeHandle);

    let isResizing = false;
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX));
      panelEl.style.width = newWidth + 'px';
    });
    document.addEventListener('mouseup', () => {
      isResizing = false;
      document.body.style.cursor = '';
    });

    console.log('[AI Arena] Side panel created');
  }

  function togglePanel() {
    if (!panelEl) createSidePanel();
    if (!panelEl) return;
    panelVisible = !panelVisible;
    panelEl.style.transform = panelVisible ? 'translateX(0)' : 'translateX(100%)';
    console.log('[AI Arena] Panel toggled:', panelVisible ? 'visible' : 'hidden');
  }

  function ensurePanelVisible() {
    if (!panelVisible) togglePanel();
  }

  // ───────────────────────────────────────────────
  // UI: Floating Button
  // ───────────────────────────────────────────────
  function createFloatingButton() {
    if (document.getElementById('ai-arena-floating-btn')) {
      console.log('[AI Arena] Floating button already exists');
      return;
    }
    if (!document.body) {
      console.log('[AI Arena] document.body not ready, cannot create floating button');
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'ai-arena-floating-btn';
    btn.textContent = '🎯';
    btn.title = 'Kimi 分析面板';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      font-size: 20px;
      cursor: pointer;
      z-index: 999998;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });
    btn.addEventListener('click', togglePanel);
    document.body.appendChild(btn);
    console.log('[AI Arena] Floating button created');
  }

  // ───────────────────────────────────────────────
  // UI: Analyze Button in ChatGPT input area
  // ───────────────────────────────────────────────
  function injectAnalyzeButton() {
    if (isButtonInjected) return;
    if (document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = true;
      return;
    }

    // Updated selectors for ChatGPT UI (2025)
    const insertionSelectors = [
      // New ChatGPT UI (composer-based)
      '[data-testid="send-button"]',
      'button[data-testid="send-button"]',
      'form button[data-testid="send-button"]',
      // Alternative: look for the submit button in the composer
      '[class*="composer"] button[type="submit"]',
      '[class*="composer"] [data-testid="send-button"]',
      // Text-based aria labels
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      // Generic fallbacks
      'form .btn-primary',
      'form button',
      '[class*="input-area"] button',
      // Very broad fallback
      'button svg[data-icon="arrow-up"]',
      'button svg[data-icon="ArrowUp"]',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      try {
        targetElement = document.querySelector(selector);
        if (targetElement) {
          console.log('[AI Arena] Found insertion point:', selector);
          break;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    if (!targetElement) {
      console.log('[AI Arena] Could not find insertion point for analyze button');
      return;
    }

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
      white-space: nowrap;
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
      handleAnalyzeClick();
    });

    // Try to find the best container to insert into
    let container = targetElement.parentElement;
    // If target is deep inside, try to find the action bar/container
    if (container) {
      // Walk up to find a flex container that looks like the input action bar
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
      console.log('[AI Arena] Analyze button injected');
    } else {
      // Fallback: insert next to target
      targetElement.insertAdjacentElement('afterend', button);
      isButtonInjected = true;
      console.log('[AI Arena] Analyze button injected (fallback)');
    }
  }

  // ───────────────────────────────────────────────
  // Core: Handle Analyze Click
  // ───────────────────────────────────────────────
  function handleAnalyzeClick() {
    const messages = extractConversation();
    if (messages.length === 0) {
      showNotification('未检测到对话内容，请确保页面已加载完成。', 'error');
      return;
    }

    console.log('[AI Arena] Extracted messages:', messages);

    const prompt = buildPrompt(messages);
    console.log('[AI Arena] Built prompt, length:', prompt.length);

    ensurePanelVisible();

    // Wait a bit for iframe to be ready if just created
    setTimeout(() => {
      if (iframeEl && iframeEl.contentWindow) {
        iframeEl.contentWindow.postMessage({
          source: 'ai-arena',
          type: 'analyze_conversation',
          payload: { prompt }
        }, '*');
        showNotification('已发送给 Kimi 分析，请查看右侧面板');
      } else {
        showNotification('Kimi 面板未就绪，请稍后再试', 'error');
      }
    }, iframeEl ? 100 : 800);
  }

  // ───────────────────────────────────────────────
  // Init with retry
  // ───────────────────────────────────────────────
  function tryInit() {
    initAttempts++;
    console.log('[AI Arena] Init attempt', initAttempts);

    if (!document.body) {
      console.log('[AI Arena] document.body not ready, will retry');
      if (initAttempts < MAX_INIT_ATTEMPTS) {
        setTimeout(tryInit, 500);
      }
      return;
    }

    createFloatingButton();
    setTimeout(injectAnalyzeButton, INJECTION_DELAY_MS);
  }

  function init() {
    tryInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also retry periodically in case of lazy loading
  const initInterval = setInterval(() => {
    if (!document.getElementById('ai-arena-floating-btn')) {
      console.log('[AI Arena] Floating button missing, retrying...');
      createFloatingButton();
    }
    if (!document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = false;
      injectAnalyzeButton();
    }
  }, RETRY_INTERVAL_MS);

  // SPA navigation
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      isButtonInjected = false;
      console.log('[AI Arena] URL changed, re-injecting button');
      setTimeout(injectAnalyzeButton, INJECTION_DELAY_MS);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Cleanup
  window.addEventListener('beforeunload', () => {
    clearInterval(initInterval);
    observer.disconnect();
  });
})();
