/**
 * AI Arena Bridge — ChatGPT Content Script
 *
 * Injected into chatgpt.com to extract conversation history
 * and provide the "Send to Kimi" button.
 */

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[AI Arena] Extension context not available');
    return;
  }

  console.log('[AI Arena] ChatGPT content script loaded');

  const INJECTION_DELAY_MS = 2000;
  let isButtonInjected = false;

  /**
   * Extract conversation messages from ChatGPT DOM
   * ChatGPT uses a data-testid based structure as of 2025
   */
  function extractConversation() {
    try {
      const messages = [];

      // Strategy 1: Look for conversation-turn articles (current ChatGPT UI)
      const turnArticles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
      if (turnArticles.length > 0) {
        turnArticles.forEach((article) => {
          // Determine role from data-testid or inner structure
          const testId = article.getAttribute('data-testid') || '';
          // Even turns are typically user, odd are assistant (starting from 0 or 1)
          // Better: look for avatar or specific markers
          const isUser = article.querySelector('img[alt*="User"], [data-testid*="user"], .rounded-sm') !== null ||
                         article.textContent.includes('You said');
          const role = isUser ? 'user' : 'assistant';

          // Extract text from markdown content
          const markdownEl = article.querySelector('.markdown, [data-message-author-role] .whitespace-pre-wrap, .text-message');
          let content = '';
          if (markdownEl) {
            content = markdownEl.textContent.trim();
          } else {
            // Fallback: get all paragraph text
            const paragraphs = article.querySelectorAll('p');
            content = Array.from(paragraphs).map(p => p.textContent.trim()).join('\n');
          }

          if (content) {
            messages.push({ role, content });
          }
        });
        return messages;
      }

      // Strategy 2: Look for message groups with role attributes
      const messageGroups = document.querySelectorAll('[data-message-author-role]');
      if (messageGroups.length > 0) {
        messageGroups.forEach((group) => {
          const role = group.getAttribute('data-message-author-role');
          const textEl = group.querySelector('.whitespace-pre-wrap, .markdown, p');
          if (textEl) {
            messages.push({
              role: role === 'user' ? 'user' : 'assistant',
              content: textEl.textContent.trim()
            });
          }
        });
        return messages;
      }

      // Strategy 3: Generic article-based extraction
      const articles = document.querySelectorAll('main article, .group article');
      articles.forEach((article) => {
        const isUser = article.querySelector('img[alt*="User"]') !== null;
        const role = isUser ? 'user' : 'assistant';
        const textEls = article.querySelectorAll('.markdown, p, [class*="text"]');
        const content = Array.from(textEls).map(el => el.textContent.trim()).join('\n');
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
      showNotification('未检测到对话内容，请确保页面已加载完成。', 'error');
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

    // Try multiple insertion points (ChatGPT UI changes frequently)
    const insertionSelectors = [
      'form[data-testid="send-button"]',
      'form button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[data-testid="send-button"]',
      'form .btn-primary',
      'form button',
      '[class*="composer"] button',
      '[class*="input-area"] button',
    ];

    let targetElement = null;
    for (const selector of insertionSelectors) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }

    if (!targetElement) {
      console.log('[AI Arena] Could not find insertion point for button');
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
      sendToKimi();
    });

    // Insert next to the target element or its container
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
  function tryInject() {
    setTimeout(injectButton, INJECTION_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInject);
  } else {
    tryInject();
  }

  // Also try on URL changes (SPA navigation)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      isButtonInjected = false;
      tryInject();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
