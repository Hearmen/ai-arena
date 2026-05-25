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

  // Skip if running inside an iframe (panel mode)
  if (window.self !== window.top) {
    console.log('[AI Arena] Kimi host adapter skipped in iframe');
    return;
  }

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
    // Reset flag if button was removed from DOM (SPA re-render)
    if (isButtonInjected && !document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = false;
    }
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
