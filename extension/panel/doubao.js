/**
 * AI Arena — Doubao Content Script
 *
 * Injected into doubao.com to:
 * 1. Listen for postMessage from ChatGPT content script
 * 2. Auto-fill received prompt into Doubao input and submit
 */

(function () {
  'use strict';

  console.log('[AI Arena] Doubao content script loaded');

  const SUBMIT_DELAY_MS = 500;
  const RETRY_INTERVAL_MS = 2000;

  let pendingPrompt = null;

  // ───────────────────────────────────────────────
  // DOM Helpers
  // ───────────────────────────────────────────────
  function findInputElement() {
    const selectors = [
      'textarea.semi-input-textarea',
      'textarea[placeholder="发消息..."]',
      'textarea',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findSendButton() {
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const svg = btn.querySelector('svg');
      if (!svg) continue;
      const path = svg.querySelector('path');
      if (!path) continue;
      const d = path.getAttribute('d') || '';
      // Doubao send button SVG contains this characteristic path
      if (d.includes('20.7505') || d.includes('11.1948')) {
        return btn;
      }
    }
    return null;
  }

  /**
   * Simulate typing text character by character.
   * Doubao uses Semi Design TextArea (React-based) which requires
   * full keyboard event sequence to update internal state properly.
   */
  function simulateTyping(element, text) {
    if (!element) return false;

    element.focus();
    element.select();

    // Clear existing content
    document.execCommand('delete', false);

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Keydown
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: char,
        code: 'Key' + (char.match(/[a-zA-Z]/) ? char.toUpperCase() : char),
        keyCode: char.charCodeAt(0),
        which: char.charCodeAt(0),
        bubbles: true,
        cancelable: true,
      }));

      // Insert the character
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const value = element.value || '';
      element.value = value.slice(0, start) + char + value.slice(end);
      element.selectionStart = element.selectionEnd = start + 1;

      // Input event
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: char,
      }));

      // Keyup
      element.dispatchEvent(new KeyboardEvent('keyup', {
        key: char,
        code: 'Key' + (char.match(/[a-zA-Z]/) ? char.toUpperCase() : char),
        keyCode: char.charCodeAt(0),
        which: char.charCodeAt(0),
        bubbles: true,
        cancelable: true,
      }));
    }

    // Final change event
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  }

  function submitToDoubao(text) {
    const input = findInputElement();
    if (!input) {
      console.error('[AI Arena] Could not find Doubao input element');
      showNotification('未找到豆包输入框，请确保页面已加载', 'error');
      return false;
    }

    const success = simulateTyping(input, text);
    if (!success) return false;

    console.log('[AI Arena] Text set in input, waiting for submit...');

    setTimeout(() => {
      const sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
        console.log('[AI Arena] Prompt submitted to Doubao via click');
        showNotification('豆包分析已发送！');
      } else {
        // Fallback: try Enter key
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

      console.log('[AI Arena] Doubao received prompt via postMessage, length:', prompt.length);

      const success = submitToDoubao(prompt);
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
      const success = submitToDoubao(pendingPrompt);
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
