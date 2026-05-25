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

  // Skip if running inside an iframe (panel mode)
  if (window.self !== window.top) {
    console.log('[AI Arena] ChatGPT adapter skipped in iframe');
    return;
  }

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
