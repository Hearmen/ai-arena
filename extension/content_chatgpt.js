/**
 * AI Arena Bridge — ChatGPT Content Script
 *
 * Injected into chatgpt.com to extract conversation history
 * and provide the "Send to Kimi" button.
 */

(function () {
  'use strict';

  const INJECTION_DELAY_MS = 2000;

  console.log('[AI Arena] ChatGPT content script loaded');

  let isButtonInjected = false;

  /**
   * Extract conversation messages from ChatGPT DOM
   */
  function extractConversation() {
    try {
      const messages = [];

      // ChatGPT uses article elements for messages
      // The structure may change, so we try multiple selectors
      const messageSelectors = [
        'article[data-testid^="conversation-turn-"]',
        'article[class*="group"]',
        'main article',
      ];

      let messageElements = [];
      for (const selector of messageSelectors) {
        messageElements = document.querySelectorAll(selector);
        if (messageElements.length > 0) break;
      }

      messageElements.forEach((article) => {
        // Determine role: user or assistant
        const isUser = article.querySelector('img[alt*="User"], [data-testid*="user"], .rounded-sm') !== null;
        const role = isUser ? 'user' : 'assistant';

        // Extract text content
        const textSelectors = [
          '.markdown',
          '[data-message-author-role] .whitespace-pre-wrap',
          '.text-message',
          'p',
        ];

        let content = '';
        for (const selector of textSelectors) {
          const elements = article.querySelectorAll(selector);
          if (elements.length > 0) {
            content = Array.from(elements)
              .map((el) => el.textContent.trim())
              .join('\n');
            break;
          }
        }

        if (content) {
          messages.push({ role, content });
        }
      });

      return messages;
    } catch (e) {
      console.error('[AI Arena] Error extracting conversation:', e);
      return [];
    }
  }

  /**
   * Send conversation to background script for analysis
   */
  function sendToKimi() {
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      showNotification('扩展上下文已失效，请刷新页面', 'error');
      return;
    }

    const messages = extractConversation();

    if (messages.length === 0) {
      alert('未检测到对话内容，请确保页面已加载完成。');
      return;
    }

    console.log('[AI Arena] Extracted messages:', messages);

    chrome.runtime.sendMessage(
      {
        type: 'analyze_conversation',
        payload: { messages },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showNotification('发送失败: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        if (response && response.success) {
          showNotification('已发送给 Kimi 分析，请查看右侧面板');
        } else {
          showNotification('发送失败，请检查后端连接', 'error');
        }
      }
    );
  }

  /**
   * Show a temporary notification on the page
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
      notification.style.border = '1px solid #fecaca';
    } else {
      notification.style.background = '#dbeafe';
      notification.style.color = '#1e40af';
      notification.style.border = '1px solid #bfdbfe';
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
   * Inject the "Send to Kimi" button into ChatGPT UI
   */
  function injectButton() {
    if (isButtonInjected) return;
    if (document.getElementById('ai-arena-analyze-btn')) {
      isButtonInjected = true;
      return;
    }

    // Try to find a good insertion point
    const insertionSelectors = [
      '[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'form button',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }

    if (!targetElement) return;

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
      sendToKimi();
    });

    // Insert next to the target element
    const container = targetElement.parentElement;
    if (container) {
      container.appendChild(button);
      isButtonInjected = true;
      console.log('[AI Arena] Analyze button injected');
    }
  }

  /**
   * Listen for messages from background script
   */
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'connection_status') {
        console.log('[AI Arena] Connection status:', request.payload);
      }
      sendResponse({ received: true });
    });
  }

  // Try to inject button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(injectButton, INJECTION_DELAY_MS); // Wait for ChatGPT to render
    });
  } else {
    setTimeout(injectButton, INJECTION_DELAY_MS);
  }

  // Also try on URL changes (SPA navigation)
  let lastUrl = location.href;
  const mainContainer = document.querySelector('main') || document.body;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      isButtonInjected = false;
      setTimeout(injectButton, INJECTION_DELAY_MS);
    }
  }).observe(mainContainer, { childList: true, subtree: false });
})();
