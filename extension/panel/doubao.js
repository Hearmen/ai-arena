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

  const SUBMIT_DELAY_MS = 600;
  const RETRY_INTERVAL_MS = 2000;

  let pendingPrompt = null;

  // ───────────────────────────────────────────────
  // DOM Helpers
  // ───────────────────────────────────────────────
  function findInputElement() {
    const selectors = [
      'textarea.semi-input-textarea',
      'textarea[placeholder*="消息"]',
      'textarea[placeholder*="输入"]',
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '.semi-input-textarea',
      '[class*="input"] textarea',
    ];
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) return el;
      } catch (e) { /* skip invalid selector */ }
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function findSendButton() {
    // Strategy 1: aria-label / title containing send-related text
    const sendLabels = ['发送', 'send', 'submit', 'arrow'];
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const className = (btn.className || '').toLowerCase();
      if (sendLabels.some(l => ariaLabel.includes(l) || title.includes(l) || className.includes(l))) {
        if (isVisible(btn)) return btn;
      }
    }

    // Strategy 2: class name containing "send"
    const sendBtn = document.querySelector('button[class*="send"], button[class*="submit"]');
    if (sendBtn && isVisible(sendBtn)) return sendBtn;

    // Strategy 3: button near the input area that is not disabled
    const input = findInputElement();
    if (input) {
      let parent = input.parentElement;
      for (let i = 0; i < 6 && parent; i++) {
        const btns = parent.querySelectorAll('button');
        for (const btn of btns) {
          if (!btn.disabled && isVisible(btn)) return btn;
        }
        parent = parent.parentElement;
      }
    }

    // Strategy 4: any visible button with an SVG icon (likely the send button)
    for (const btn of allButtons) {
      if (btn.querySelector('svg') && !btn.disabled && isVisible(btn)) {
        return btn;
      }
    }

    return null;
  }

  /**
   * Set input text using the most reliable method for the element type.
   */
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
      // Use native value setter to bypass React's synthetic event system
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      if (nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, text);
      } else {
        element.value = text;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  /**
   * Fallback: simulate typing character by character.
   * Some React-based inputs need full keyboard event sequence.
   */
  function simulateTyping(element, text) {
    if (!element) return false;

    element.focus();
    if (element.select) element.select();

    // Clear existing content
    try {
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);
    } catch (e) {
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value = '';
      } else if (element.isContentEditable) {
        element.innerHTML = '';
      }
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = char.charCodeAt(0);

      // Keydown
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: char,
        code: 'Key' + (char.match(/[a-zA-Z]/) ? char.toUpperCase() : char),
        keyCode: code,
        which: code,
        bubbles: true,
        cancelable: true,
      }));

      // Insert the character
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const start = element.selectionStart || 0;
        const end = element.selectionEnd || 0;
        const value = element.value || '';
        element.value = value.slice(0, start) + char + value.slice(end);
        element.selectionStart = element.selectionEnd = start + 1;
      } else if (element.isContentEditable) {
        document.execCommand('insertText', false, char);
      }

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
        keyCode: code,
        which: code,
        bubbles: true,
        cancelable: true,
      }));
    }

    // Final change/composition event
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('compositionend', { bubbles: true }));

    return true;
  }

  function submitToDoubao(text) {
    const input = findInputElement();
    if (!input) {
      console.error('[AI Arena] Could not find Doubao input element');
      showNotification('未找到豆包输入框，请确保页面已加载', 'error');
      return false;
    }

    console.log('[AI Arena] Found Doubao input:', input.tagName, input.className?.slice(0, 50));

    // Try simple text setting first (fastest and most reliable)
    let success = setInputText(input, text);

    // Fallback to simulated typing if simple method didn't work
    if (!success || !input.value && !input.innerText) {
      console.log('[AI Arena] Simple input failed, trying simulated typing');
      success = simulateTyping(input, text);
    }

    if (!success) return false;

    console.log('[AI Arena] Text set in input, waiting for submit...');

    setTimeout(() => {
      const sendBtn = findSendButton();
      if (sendBtn) {
        console.log('[AI Arena] Found send button, clicking:', sendBtn.className?.slice(0, 50));
        sendBtn.click();
        console.log('[AI Arena] Prompt submitted to Doubao via click');
        showNotification('豆包分析已发送！');
      } else {
        // Fallback: try Enter key
        console.log('[AI Arena] Send button not found, trying Enter key fallback');
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true, composed: true,
        }));
        input.dispatchEvent(new KeyboardEvent('keypress', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true, composed: true,
        }));
        input.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true, composed: true,
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
