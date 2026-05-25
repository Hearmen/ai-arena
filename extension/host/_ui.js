/**
 * AI Arena — Host UI Components
 *
 * Platform-agnostic UI factories. Actual DOM insertion is handled by platform adapters.
 */
(function () {
  'use strict';

  window.AIArena = window.AIArena || {};

  window.AIArena.UI = {
    createFloatingButton(config, onClick) {
      if (document.getElementById('ai-arena-floating-btn')) return null;
      if (!document.body) return null;

      const btn = document.createElement('button');
      btn.id = 'ai-arena-floating-btn';
      btn.textContent = config.fabIcon || '🎯';
      btn.title = config.fabTitle;
      btn.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${config.color};
        color: white;
        border: none;
        font-size: 20px;
        cursor: pointer;
        z-index: 999998;
        box-shadow: 0 4px 12px ${config.shadowColor};
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.1)';
        btn.style.boxShadow = `0 6px 20px ${config.shadowColor.replace('0.4', '0.5')}`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = `0 4px 12px ${config.shadowColor}`;
      });
      btn.addEventListener('click', onClick);
      document.body.appendChild(btn);
      return btn;
    },

    createAnalyzeButton(config, onClick) {
      const button = document.createElement('button');
      button.id = 'ai-arena-analyze-btn';
      button.textContent = config.btnText;
      button.style.cssText = `
        margin-left: 8px;
        padding: 8px 16px;
        background: ${config.color};
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
        button.style.boxShadow = `0 4px 12px ${config.shadowColor}`;
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      });
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return button;
    },
  };

  console.log('[AI Arena] UI components loaded');
})();
