/**
 * AI Arena — Provider & Platform Registry
 *
 * Central configuration for all supported panel models and host platforms.
 * To add a new model: add entry to `models`.
 * To add a new host platform: add entry to `platforms`.
 */
(function () {
  'use strict';

  window.AIArena = window.AIArena || {};

  window.AIArena.Registry = {
    platforms: {
      chatgpt: {
        name: 'ChatGPT',
        matches: ['https://chatgpt.com/*'],
      },
      // Future: claude, gemini, etc.
    },

    models: {
      kimi: {
        name: 'Kimi',
        title: '🎯 Kimi 分析面板',
        iframeSrc: 'https://kimi.com',
        btnText: '🎯 让 Kimi 分析',
        fabTitle: 'Kimi 分析面板',
        fabIcon: '🎯',
        color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        shadowColor: 'rgba(102, 126, 234, 0.4)',
      },
      doubao: {
        name: '豆包',
        title: '📦 豆包分析面板',
        iframeSrc: 'https://www.doubao.com/chat',
        btnText: '📦 让豆包分析',
        fabTitle: '豆包分析面板',
        fabIcon: '📦',
        color: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
        shadowColor: 'rgba(238, 90, 36, 0.4)',
      },
      // Future: deepseek, qianwen, etc.
    },

    getModel(key) {
      return this.models[key] || null;
    },

    getPlatform(key) {
      return this.platforms[key] || null;
    },

    getModelKeys() {
      return Object.keys(this.models);
    },
  };

  console.log('[AI Arena] Registry loaded');
})();
