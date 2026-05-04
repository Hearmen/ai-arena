/**
 * AI Arena Bridge — Kimi Content Script
 *
 * Injected into kimi.com to receive analysis prompts
 * and auto-submit them into Kimi's chat input.
 *
 * Based on actual DOM structure of kimi.com (2025):
 * - Input: .chat-input-editor (contenteditable DIV)
 * - Send button: .send-button-container (DIV with SVG icon)
 */

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[AI Arena] Extension context not available');
    return;
  }

  console.log('[AI Arena] Kimi content script loaded');

  const SUBMIT_DELAY_MS = 500; // Wait for React to register input change
  const RETRY_INTERVAL_MS = 2000;

  let pendingPrompt = null;

  /**
   * Find the chat input element on Kimi page
   * kimi.com uses a contenteditable div with class .chat-input-editor
   */
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

  /**
   * Find the send button on Kimi page
   * kimi.com uses .send-button-container (a div, not a button)
   */
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

  /**
   * Set text in the Kimi input element
   * kimi.com uses a contenteditable div (Lexical editor)
   */
  function setInputText(element, text) {
    if (!element) return false;

    // Focus the element first
    element.focus();

    if (element.isContentEditable) {
      // For contenteditable divs (Lexical editor)
      // Clear existing content
      element.innerHTML = '';

      // Create a paragraph with the text
      const p = document.createElement('p');
      p.textContent = text;
      element.appendChild(p);

      // Dispatch input events to trigger React/Vue reactivity
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));

      // Also dispatch a regular input event
      element.dispatchEvent(new Event('input', { bubbles: true }));

      // Dispatch change event
      element.dispatchEvent(new Event('change', { bubbles: true }));

      // Set cursor at the end
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

  /**
   * Submit the prompt text to Kimi
   */
  function submitToKimi(text) {
    const input = findInputElement();
    if (!input) {
      console.error('[AI Arena] Could not find Kimi input element');
      showNotification('未找到 Kimi 输入框，请确保页面已加载', 'error');
      return false;
    }

    // Set the text
    const success = setInputText(input, text);
    if (!success) {
      console.error('[AI Arena] Failed to set input text');
      return false;
    }

    console.log('[AI Arena] Text set in input, waiting for submit...');

    // Wait a bit for React to register the change, then click send
    setTimeout(() => {
      const sendBtn = findSendButton();
      if (sendBtn) {
        // Check if button is disabled
        const isDisabled = sendBtn.classList.contains('disabled');
        if (isDisabled) {
          console.log('[AI Arena] Send button is disabled, trying Enter key');
          // Try pressing Enter on the input
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          });
          input.dispatchEvent(enterEvent);
        } else {
          sendBtn.click();
          console.log('[AI Arena] Prompt submitted to Kimi via click');
          showNotification('Kimi 分析已发送！');
        }
      } else {
        // Fallback: try pressing Enter
        console.log('[AI Arena] Send button not found, trying Enter key');
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(enterEvent);
      }
    }, SUBMIT_DELAY_MS);

    return true;
  }

  /**
   * Show a temporary notification
   */
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
      z-index: 999999;
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
    if (document.body) {
      document.body.appendChild(notification);
    }

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Listen for messages from background script
   */
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[AI Arena] Kimi received message:', request);

      if (request.type === 'analysis_complete') {
        const fullText = request.payload.full_text;
        console.log('[AI Arena] Received prompt, length:', fullText.length);

        // Try to submit immediately
        const success = submitToKimi(fullText);
        if (!success) {
          // Store for later if page not ready
          pendingPrompt = fullText;
          console.log('[AI Arena] Storing prompt for retry');
        }
      } else if (request.type === 'connection_status') {
        console.log('[AI Arena] Connection status:', request.payload);
      }

      sendResponse({ received: true });
      return true;
    });
  }

  // Check for pending prompt when page loads/changes
  const checkPending = () => {
    if (pendingPrompt) {
      console.log('[AI Arena] Retrying pending prompt');
      const success = submitToKimi(pendingPrompt);
      if (success) {
        pendingPrompt = null;
      }
    }
  };

  // Run check periodically
  const pendingInterval = setInterval(checkPending, RETRY_INTERVAL_MS);

  // Also check on DOM changes
  const pendingObserver = new MutationObserver(checkPending);
  pendingObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(pendingInterval);
    pendingObserver.disconnect();
  });
})();
