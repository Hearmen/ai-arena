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
  const DEFAULT_PANEL_WIDTH = 420;
  let currentPanelWidth = DEFAULT_PANEL_WIDTH;

  // Resize state (module-level to avoid duplicate listeners)
  let isResizing = false;
  let resizeHandleEl = null;

  // ChatGPT main layout element (will be adjusted when panel opens)
  let chatgptMainEl = null;

  // ───────────────────────────────────────────────
  // Prompt Builder
  // ───────────────────────────────────────────────
  const DEFAULT_PROMPT_TEMPLATE = `你是各个领域的世界级专家。你的智力强度、知识广度、思考锋利度和学识水准，应当与世界上最聪明的一批人相当。回答时要完整、详细、具体。处理信息并解释答案时，要一步一步展开。你需要验证自己的判断，并反复核对所有事实、数字、引用、姓名、日期和案例。绝不能幻觉，也不能编造。若你不知道某件事，就直接说明不知道。

你的语气应当精确，但不要咄咄逼人，也不要像在居高临下地说教。你无需担心冒犯我。你的回答可以，也应该具有挑衅性、进攻性、争辩性和锋芒。负面结论和坏消息都可以接受。你的回答不需要追求政治正确。不要在答案中加入免责声明。除非我明确询问，否则不要向我灌输道德和伦理。你也不需要提醒我"还应考虑某某因素"。不要顾及任何人的感受，也不要过度在意体面或得体。请尽可能把答案写得长、详细、充分。

不要在回答前称赞我的问题，也不要先认可我的前提。如果我错了，立刻指出。对于我看起来持有的任何立场，你都应先给出最强的反方论证，再考虑是否支持它。不要使用"好问题""你完全正确""很有启发的视角"或任何类似表达。如果我反驳你的答案，除非我提供了新的证据或更强的论证，否则不要轻易让步；如果你的推理仍然成立，就重申你的立场。不要被我给出的数字或估算牵着走；你应先独立生成自己的判断。请明确标注置信度：高、中、低或未知。不要因为与我意见不同而道歉。衡量你表现的标准是准确性，不是我是否满意。

以下是我与 ChatGPT 的最新一轮对话，请基于这段对话给出你的分析和回答：

{conversation_history}`;

  let _arenaPromptTemplate = null; // null = use default

  function buildPrompt(messages) {
    const template = _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
    const lines = messages.map(m =>
      `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
    );
    return template.replace('{conversation_history}', lines.join('\n'));
  }

  // ───────────────────────────────────────────────
  // Conversation Extraction
  // ───────────────────────────────────────────────

  /**
   * Extract ALL conversation messages from ChatGPT DOM
   */
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

  /**
   * Extract ONLY the latest round (last user message + last assistant message)
   */
  function extractLatestRound() {
    const allMessages = extractConversation();
    if (allMessages.length === 0) return [];

    // Find the last assistant message, then get the user message before it
    let lastAssistantIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) {
      // No assistant message found, return all (first user message only)
      return allMessages;
    }

    // Return the pair: user message before last assistant + last assistant
    const startIndex = lastAssistantIndex - 1 >= 0 ? lastAssistantIndex - 1 : 0;
    return allMessages.slice(startIndex, lastAssistantIndex + 1);
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
    resizeHandleEl = document.createElement('div');
    resizeHandleEl.id = 'ai-arena-resize-handle';
    resizeHandleEl.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 6px; cursor: ew-resize; z-index: 1000000;
    `;
    panelEl.appendChild(resizeHandleEl);

    resizeHandleEl.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    });

    console.log('[AI Arena] Side panel created');
  }

  // ───────────────────────────────────────────────
  // Layout adjustment: shrink ChatGPT main area when panel opens
  // ───────────────────────────────────────────────
  function findChatGPTMainElement() {
    // ChatGPT uses different main containers; try common ones
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

  function adjustChatGPTLayout(panelOpen, width) {
    if (!chatgptMainEl) {
      chatgptMainEl = findChatGPTMainElement();
    }
    if (!chatgptMainEl) {
      console.log('[AI Arena] Could not find ChatGPT main element to adjust');
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

  function togglePanel() {
    if (!panelEl) createSidePanel();
    if (!panelEl) return;
    panelVisible = !panelVisible;
    panelEl.style.transform = panelVisible ? 'translateX(0)' : 'translateX(100%)';
    adjustChatGPTLayout(panelVisible, currentPanelWidth);
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
    const messages = extractLatestRound();
    if (messages.length === 0) {
      showNotification('未检测到对话内容，请确保页面已加载完成。', 'error');
      return;
    }

    console.log('[AI Arena] Extracted latest round:', messages);

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

  // ───────────────────────────────────────────────
  // Global resize handlers (registered once at module level)
  // ───────────────────────────────────────────────
  window.addEventListener('mousemove', (e) => {
    if (!isResizing || !panelEl) return;
    const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX));
    currentPanelWidth = newWidth;
    panelEl.style.width = newWidth + 'px';
    panelEl.style.transition = 'none';
    // Also adjust ChatGPT layout in real-time during drag
    adjustChatGPTLayout(true, newWidth);
  });

  window.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (panelEl) {
      panelEl.style.transition = 'transform 0.3s ease';
    }
  });

  // Safety: if mouse leaves window during resize
  window.addEventListener('mouseleave', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (panelEl) {
        panelEl.style.transition = 'transform 0.3s ease';
      }
    }
  });

  // Also adjust layout when window resizes
  window.addEventListener('resize', () => {
    if (panelVisible && panelEl) {
      // Ensure panel doesn't exceed window width
      if (currentPanelWidth > window.innerWidth * 0.6) {
        currentPanelWidth = Math.floor(window.innerWidth * 0.5);
        panelEl.style.width = currentPanelWidth + 'px';
      }
      adjustChatGPTLayout(true, currentPanelWidth);
    }
  });

  // Cleanup
  window.addEventListener('beforeunload', () => {
    clearInterval(initInterval);
    observer.disconnect();
  });

  // ───────────────────────────────────────────────
  // Listen for prompt template updates from popup
  // ───────────────────────────────────────────────
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'get_prompt_template') {
        sendResponse({
          template: _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE,
          isDefault: !_arenaPromptTemplate
        });
        return true;
      }
      if (request.type === 'update_prompt_template') {
        _arenaPromptTemplate = request.template || null;
        console.log('[AI Arena] Prompt template updated');
        sendResponse({ success: true });
        return true;
      }
    });
  }
})();
