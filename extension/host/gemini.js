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
