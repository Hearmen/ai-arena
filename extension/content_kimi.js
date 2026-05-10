/**
 * AI Arena — Kimi Content Script (V2)
 *
 * Injected into kimi.com (including inside iframe) to:
 * 1. Listen for postMessage from ChatGPT content script
 * 2. Auto-fill received prompt into Kimi input and submit
 */

(function () {
  'use strict';

  console.log('[AI Arena] Kimi content script loaded (V2)');

  const SUBMIT_DELAY_MS = 500;
  const RETRY_INTERVAL_MS = 2000;

  let pendingPrompt = null;

  // ───────────────────────────────────────────────
  // DOM Helpers
  // ───────────────────────────────────────────────
  function findInputElement() {
    const selectors = [
      '.chat-input-editor',
      '[data-lexical-editor="true"]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findSendButton() {
    const selectors = [
      '.send-button-container:not(.disabled)',
      '.send-button-container',
      '[class*="send-button"]',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function setInputText(element, text) {
    if (!element) return false;
    element.focus();

    if (element.isContentEditable) {
      element.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = text;
      element.appendChild(p);

      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function submitToKimi(text) {
    const input = findInputElement();
    if (!input) {
      console.error('[AI Arena] Could not find Kimi input element');
      showNotification('未找到 Kimi 输入框，请确保页面已加载', 'error');
      return false;
    }

    const success = setInputText(input, text);
    if (!success) return false;

    console.log('[AI Arena] Text set in input, waiting for submit...');

    setTimeout(() => {
      const sendBtn = findSendButton();
      if (sendBtn) {
        const isDisabled = sendBtn.classList.contains('disabled');
        if (isDisabled) {
          input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
            bubbles: true, cancelable: true,
          }));
        } else {
          sendBtn.click();
          console.log('[AI Arena] Prompt submitted to Kimi via click');
          showNotification('Kimi 分析已发送！');
        }
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        }));
      }
    }, SUBMIT_DELAY_MS);

    return true;
  }

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
    } else {
      notification.style.background = '#dbeafe';
      notification.style.color = '#1e40af';
    }
    notification.textContent = message;
    if (document.body) document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ───────────────────────────────────────────────
  // Listen for postMessage from ChatGPT page
  // ───────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    // Validate message source and structure
    if (event.data && event.data.source === 'ai-arena' && event.data.type === 'analyze_conversation') {
      const prompt = event.data.payload?.prompt;
      if (!prompt) {
        console.warn('[AI Arena] Received analyze_conversation but no prompt');
        return;
      }

      console.log('[AI Arena] Kimi received prompt via postMessage, length:', prompt.length);

      const success = submitToKimi(prompt);
      if (!success) {
        pendingPrompt = prompt;
        console.log('[AI Arena] Storing prompt for retry');
      }
    }
  });

  // ───────────────────────────────────────────────
  // Retry pending prompt
  // ───────────────────────────────────────────────
  const checkPending = () => {
    if (pendingPrompt) {
      console.log('[AI Arena] Retrying pending prompt');
      const success = submitToKimi(pendingPrompt);
      if (success) pendingPrompt = null;
    }
  };

  const pendingInterval = setInterval(checkPending, RETRY_INTERVAL_MS);
  const pendingObserver = new MutationObserver(checkPending);
  pendingObserver.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('beforeunload', () => {
    clearInterval(pendingInterval);
    pendingObserver.disconnect();
  });
})();
