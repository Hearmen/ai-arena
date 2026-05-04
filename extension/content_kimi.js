/**
 * AI Arena Bridge — Kimi Content Script
 *
 * Injected into moonshot.cn to receive analysis results
 * and auto-submit them into Kimi's chat input.
 */

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[AI Arena] Extension context not available');
    return;
  }

  console.log('[AI Arena] Kimi content script loaded');

  const SUBMIT_DELAY_MS = 500; // Wait for React/Vue to register input change

  let pendingAnalysis = null;

  /**
   * Find the chat input element on Kimi page
   */
  function findInputElement() {
    const selectors = [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="发送"]',
      'div[contenteditable="true"]',
      'textarea',
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
   */
  function findSendButton() {
    const selectors = [
      'button[aria-label*="发送"]',
      'button[type="submit"]',
      'button svg[viewBox]',
      'button:has(svg)',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * Set text in an input element (handles both textarea and contenteditable)
   */
  function setInputText(element, text) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.isContentEditable) {
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Submit the analysis text to Kimi
   */
  function submitToKimi(text) {
    const input = findInputElement();
    if (!input) {
      console.error('[AI Arena] Could not find Kimi input element');
      showNotification('未找到 Kimi 输入框，请确保页面已加载', 'error');
      return false;
    }

    // Set the text
    setInputText(input, text);

    // Wait a bit for React/Vue to register the change
    setTimeout(() => {
      const sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
        console.log('[AI Arena] Analysis submitted to Kimi');
        showNotification('Kimi 分析已发送！');
      } else {
        // Try pressing Enter
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(enterEvent);
        console.log('[AI Arena] Submitted via Enter key');
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
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[AI Arena] Kimi received message:', request);

    if (request.type === 'analysis_complete') {
      const fullText = request.payload.full_text;
      console.log('[AI Arena] Received analysis, length:', fullText.length);

      // Try to submit immediately
      const success = submitToKimi(fullText);
      if (!success) {
        // Store for later if page not ready
        pendingAnalysis = fullText;
      }
    } else if (request.type === 'connection_status') {
      console.log('[AI Arena] Connection status:', request.payload);
    }

    sendResponse({ received: true });
    return true;
  });

  // Check for pending analysis when page loads/changes
  const checkPending = () => {
    if (pendingAnalysis) {
      const success = submitToKimi(pendingAnalysis);
      if (success) {
        pendingAnalysis = null;
      }
    }
  };

  // Run check periodically
  const pendingInterval = setInterval(checkPending, 2000);

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
